import type { Client } from "@microsoft/microsoft-graph-client";

import { env } from "@config/env.js";

import { log } from "@util/logger.js";

import { getOrCreateFolder } from "./onedrive-folder.js";
import type { UploadResult } from "./types.js";

/**
 * Maximum file size for simple upload (4MB)
 * Files larger than this will use upload session
 */
const MAX_SIMPLE_UPLOAD_SIZE = 4 * 1024 * 1024;

/**
 * Chunk size for upload session (320KB recommended by Microhard - I mean Microsoft)
 */
const UPLOAD_CHUNK_SIZE = 320 * 1024;

/**
 * Uploads a file to OneDrive using simple upload (for files < 4MB)
 *
 * @param client - Microsoft Graph client
 * @param driveId - The OneDrive drive ID
 * @param folderId - The folder ID to upload to
 * @param fileName - Name of the file
 * @param fileBuffer - File content as Buffer
 * @returns Upload result
 */
async function simpleUpload(
  client: Client,
  driveId: string,
  folderId: string,
  fileName: string,
  fileBuffer: Buffer,
  retryCount = 0
): Promise<UploadResult> {
  try {
    log.info(`Starting simple upload for: ${fileName} (${fileBuffer.length} bytes)`);

    const response = await client
      .api(`/drives/${driveId}/items/${folderId}:/${fileName}:/content`)
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .put(fileBuffer);

    log.info(` OneDrive confirmed upload: ${fileName} (${fileBuffer.length} bytes) - File ID: ${response.id}`);

    return {
      success: true,
      fileId: response.id,
      fileName: response.name,
      webUrl: response.webUrl,
    };
  } catch (error: unknown) {
    // Check if it's a 401 (token expired) and we haven't retried yet
    const graphError = error as { statusCode?: number };
    if (graphError?.statusCode === 401 && retryCount === 0) {
      log.warn(`Token expired, attempting to refresh and retry upload for: ${fileName}`);

      // Try to refresh the token
      const { refreshTokenIfNeeded, getOneDriveConfigFromEnv, createGraphClient } =
        await import("./onedrive-client.js");
      const config = getOneDriveConfigFromEnv();
      const newToken = await refreshTokenIfNeeded(config);

      if (newToken) {
        log.info("Token refreshed successfully, retrying upload");
        // Create new client with refreshed token
        const newConfig = { ...config, accessToken: newToken };
        const newClient = createGraphClient(newConfig);
        // Retry once with new token
        return simpleUpload(newClient, driveId, folderId, fileName, fileBuffer, retryCount + 1);
      }
    }

    log.error({ err: error }, `Simple upload failed for: ${fileName}`);
    return {
      success: false,
      fileName,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Uploads a file to OneDrive using upload session (for files >= 4MB)
 *
 * @param client - Microsoft Graph client
 * @param driveId - The OneDrive drive ID
 * @param folderId - The folder ID to upload to
 * @param fileName - Name of the file
 * @param fileBuffer - File content as Buffer
 * @returns Upload result
 */
async function sessionUpload(
  client: Client,
  driveId: string,
  folderId: string,
  fileName: string,
  fileBuffer: Buffer,
  retryCount = 0
): Promise<UploadResult> {
  try {
    log.info(`Starting upload session for: ${fileName} (${fileBuffer.length} bytes)`);

    // Create upload session
    const uploadSession = await client
      .api(`/drives/${driveId}/items/${folderId}:/${fileName}:/createUploadSession`)
      .post({
        item: {
          "@microsoft.graph.conflictBehavior": "replace",
          name: fileName,
        },
      });

    const uploadUrl = uploadSession.uploadUrl;
    const fileSize = fileBuffer.length;
    let uploadedBytes = 0;

    // Upload file in chunks
    while (uploadedBytes < fileSize) {
      const chunkStart = uploadedBytes;
      const chunkEnd = Math.min(uploadedBytes + UPLOAD_CHUNK_SIZE, fileSize);
      const chunk = fileBuffer.subarray(chunkStart, chunkEnd);

      const contentRange = `bytes ${chunkStart}-${chunkEnd - 1}/${fileSize}`;

      log.info(`Uploading chunk: ${contentRange}`);

      const response = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Length": chunk.length.toString(),
          "Content-Range": contentRange,
        },
        body: new Uint8Array(chunk),
      });

      if (!response.ok && response.status !== 202) {
        throw new Error(`Upload failed with status: ${response.status}`);
      }

      uploadedBytes = chunkEnd;

      // Final chunk returns the file metadata
      if (uploadedBytes === fileSize) {
        const result = await response.json();
        log.info(`File uploaded successfully: ${fileName}`);

        return {
          success: true,
          fileId: result.id,
          fileName: result.name,
          webUrl: result.webUrl,
        };
      }
    }

    throw new Error("Upload completed but no file metadata received");
  } catch (error: unknown) {
    const graphError = error as { statusCode?: number };
    if (graphError?.statusCode === 401 && retryCount === 0) {
      log.warn(`Token expired, attempting to refresh and retry session upload for: ${fileName}`);

      const { refreshTokenIfNeeded, getOneDriveConfigFromEnv, createGraphClient } =
        await import("./onedrive-client.js");
      const config = getOneDriveConfigFromEnv();
      const newToken = await refreshTokenIfNeeded(config);

      if (newToken) {
        log.info("Token refreshed successfully, retrying session upload");
        const newConfig = { ...config, accessToken: newToken };
        const newClient = createGraphClient(newConfig);
        return sessionUpload(newClient, driveId, folderId, fileName, fileBuffer, retryCount + 1);
      }
    }

    log.error({ err: error }, `Session upload failed for: ${fileName}`);
    return {
      success: false,
      fileName,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Uploads a file to OneDrive
 * Automatically chooses between simple upload and upload session based on file size
 *
 * @param client - Microsoft Graph client
 * @param fileName - Name of the file
 * @param fileBuffer - File content as Buffer
 * @param folderPath - Optional folder path (defaults to env.ONEDRIVE_FOLDER_PATH)
 * @param retryCount - Internal retry counter (default 0)
 * @returns Upload result
 */
export async function uploadFileToOneDrive(
  client: Client,
  fileName: string,
  fileBuffer: Buffer,
  folderPath?: string,
  retryCount = 0
): Promise<UploadResult> {
  try {
    const driveId = env.AZURE_ONEDRIVE_DRIVE_ID;
    const targetFolderPath = folderPath || env.ONEDRIVE_FOLDER_PATH;

    log.info(`Preparing to upload file: ${fileName} to ${targetFolderPath}`);

    // Get or create the target folder
    const folder = await getOrCreateFolder(client, driveId, targetFolderPath);

    // Choose upload method based on file size
    if (fileBuffer.length < MAX_SIMPLE_UPLOAD_SIZE) {
      return await simpleUpload(client, driveId, folder.id, fileName, fileBuffer);
    } else {
      return await sessionUpload(client, driveId, folder.id, fileName, fileBuffer);
    }
  } catch (error: unknown) {
    const graphError = error as { statusCode?: number };
    if (graphError?.statusCode === 401 && retryCount === 0) {
      log.warn(`Token expired during upload, attempting to refresh and retry: ${fileName}`);

      const { refreshTokenIfNeeded, getOneDriveConfigFromEnv, createGraphClient } =
        await import("./onedrive-client.js");
      const config = getOneDriveConfigFromEnv();
      const newToken = await refreshTokenIfNeeded(config);

      if (newToken) {
        log.info("Token refreshed successfully, retrying upload");
        const newConfig = { ...config, accessToken: newToken };
        const newClient = createGraphClient(newConfig);
        return uploadFileToOneDrive(newClient, fileName, fileBuffer, folderPath, retryCount + 1);
      }
    }

    log.error({ err: error }, `Failed to upload file: ${fileName}`);
    return {
      success: false,
      fileName,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
