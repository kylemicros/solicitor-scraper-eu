/**
 * OneDrive folder item structure
 */
export interface OneDriveFolderItem {
  id: string;
  name: string;
  folder?: {
    childCount: number;
  };
  parentReference?: {
    driveId: string;
    path: string;
  };
}

/**
 * OneDrive upload session response
 */
export interface UploadSessionResponse {
  uploadUrl: string;
  expirationDateTime: string;
}

/**
 * OneDrive file upload result
 */
export interface UploadResult {
  success: boolean;
  fileId?: string;
  fileName: string;
  webUrl?: string;
  error?: string;
}

/**
 * Configuration for OneDrive client
 */
export interface OneDriveConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  driveId: string;
  accessToken: string;
  refreshToken: string;
  folderPath?: string;
  itemId?: string;
}
