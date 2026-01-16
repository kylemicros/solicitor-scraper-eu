import { Client } from "@microsoft/microsoft-graph-client";
import "isomorphic-fetch";

import { env } from "@config/env.js";

import { log } from "@util/logger.js";

import type { OneDriveConfig } from "./types.js";

// Refresh token storage (in-memory for now)
let cachedAccessToken: string | null = null;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let cachedRefreshToken: string | null = null;

/**
 * Refreshes the access token using the refresh token
 */
async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<{ accessToken: string; refreshToken?: string } | null> {
  try {
    log.info("Refreshing OneDrive access token...");

    const response = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
        scope: "Files.ReadWrite offline_access",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      log.error({ error: errorData }, "Failed to refresh access token");
      return null;
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    // Cache the new tokens
    cachedAccessToken = data.access_token;
    if (data.refresh_token) {
      cachedRefreshToken = data.refresh_token;
    }

    log.info({ expiresIn: data.expires_in }, "Successfully refreshed OneDrive access token");

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };
  } catch (error) {
    log.error({ error }, "Error refreshing access token");
    return null;
  }
}

/**
 * Creates and configures a Microsoft Graph client for OneDrive operations
 * Supports both user OAuth (delegated) and service principal (application) auth
 *
 * @param config - OneDrive configuration
 * @returns Configured Graph client
 */
export function createGraphClient(config: OneDriveConfig): Client {
  // Service Principal (App-Only) Authentication
  if (config.accessToken && config.accessToken !== "placeholder") {
    log.info("Using user OAuth authentication (delegated permissions)");

    // Initialize cached tokens
    if (!cachedAccessToken) {
      cachedAccessToken = config.accessToken;
      cachedRefreshToken = config.refreshToken;
    }

    return Client.init({
      authProvider: async (done) => {
        // Try to use cached token or refresh if needed
        let token = cachedAccessToken;

        // If we have a refresh token and client credentials, we can auto-refresh
        if (config.refreshToken && config.clientId && config.clientSecret) {
          // In a real scenario, you'd check token expiration here
          // For simplicity, we'll try to use the current token first
          // and refresh on 401 errors (handled by the caller)
          token = cachedAccessToken || config.accessToken;
        }

        done(null, token);
      },
    });
  }

  throw new Error(
    "No valid OneDrive authentication method available. Please provide AZURE_ACCESS_TOKEN in environment."
  );
}

/**
 * Attempts to refresh the access token if needed
 */
export async function refreshTokenIfNeeded(config: OneDriveConfig): Promise<string | null> {
  if (!config.refreshToken || !config.clientId || !config.clientSecret) {
    return null;
  }

  const result = await refreshAccessToken(config.clientId, config.clientSecret, config.refreshToken);

  return result?.accessToken || null;
}

/**
 * Creates a OneDrive configuration from environment variables
 *
 * @returns OneDrive configuration object
 */
export function getOneDriveConfigFromEnv(): OneDriveConfig {
  return {
    clientId: env.AZURE_CLIENT_ID,
    clientSecret: env.AZURE_CLIENT_SECRET,
    tenantId: env.AZURE_TENANT_ID,
    driveId: env.AZURE_ONEDRIVE_DRIVE_ID,
    accessToken: env.AZURE_ACCESS_TOKEN,
    refreshToken: env.AZURE_REFRESH_TOKEN,
    folderPath: env.ONEDRIVE_FOLDER_PATH,
    itemId: env.AZURE_ONEDRIVE_ITEM_ID,
  };
}

/**
 * Gets or creates a OneDrive Graph client instance
 *
 * @returns Microsoft Graph Client
 */
export function getOneDriveClient(): Client {
  try {
    const config = getOneDriveConfigFromEnv();
    const client = createGraphClient(config);

    log.info("OneDrive client initialized successfully");

    return client;
  } catch (error) {
    log.error({ err: error }, "Failed to initialize OneDrive client");
    throw error;
  }
}
