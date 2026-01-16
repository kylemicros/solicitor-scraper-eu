import type { Client } from "@microsoft/microsoft-graph-client";

import { log } from "@util/logger.js";

import type { OneDriveFolderItem } from "./types.js";

/**
 * Gets a folder by path in OneDrive
 *
 * @param client - Microsoft Graph client
 * @param driveId - The OneDrive drive ID
 * @param folderPath - The folder path (e.g., "/Reports")
 * @returns Folder item or null if not found
 */
export async function getFolderByPath(
  client: Client,
  driveId: string,
  folderPath: string
): Promise<OneDriveFolderItem | null> {
  try {
    const response = await client.api(`/drives/${driveId}/root:${folderPath}:`).get();

    log.info(`Found folder: ${folderPath}`);
    return response as OneDriveFolderItem;
  } catch (error: unknown) {
    const err = error as { statusCode?: number };
    if (err.statusCode === 404) {
      log.warn(`Folder not found: ${folderPath}`);
      return null;
    }
    log.error({ err: error }, `Failed to get folder: ${folderPath}`);
    throw error;
  }
}

/**
 * Creates a folder in OneDrive
 *
 * @param client - Microsoft Graph client
 * @param driveId - The OneDrive drive ID
 * @param folderPath - The folder path to create
 * @returns Created folder item
 */
export async function createFolder(client: Client, driveId: string, folderPath: string): Promise<OneDriveFolderItem> {
  try {
    const pathParts = folderPath.split("/").filter(Boolean);
    const folderName = pathParts[pathParts.length - 1];
    const parentPath = pathParts.length > 1 ? "/" + pathParts.slice(0, -1).join("/") : "/";

    const endpoint =
      parentPath === "/" ? `/drives/${driveId}/root/children` : `/drives/${driveId}/root:${parentPath}:/children`;

    const response = await client.api(endpoint).post({
      name: folderName,
      folder: {},
      "@microsoft.graph.conflictBehavior": "fail",
    });

    log.info(`Created folder: ${folderPath}`);
    return response as OneDriveFolderItem;
  } catch (error) {
    log.error({ err: error }, `Failed to create folder: ${folderPath}`);
    throw error;
  }
}

/**
 * Gets or creates a folder in OneDrive
 *
 * @param client - Microsoft Graph client
 * @param driveId - The OneDrive drive ID
 * @param folderPath - The folder path
 * @returns Folder item
 */
export async function getOrCreateFolder(
  client: Client,
  driveId: string,
  folderPath: string
): Promise<OneDriveFolderItem> {
  let folder = await getFolderByPath(client, driveId, folderPath);

  if (!folder) {
    log.info(`Folder does not exist, creating: ${folderPath}`);
    folder = await createFolder(client, driveId, folderPath);
  }

  return folder;
}
