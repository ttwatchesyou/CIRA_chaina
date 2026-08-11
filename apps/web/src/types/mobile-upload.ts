export type MobileUploadLink = {
  id: string;
  url: string;
  expiresAt: string;
};

export type MobileUploadAccess = {
  projectName: string;
  expiresAt: string;
  maxFiles: number;
  maxImageSizeBytes: number;
};
