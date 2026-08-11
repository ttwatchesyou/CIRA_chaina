export const supportedImageMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;

export const MAX_IMAGE_SIZE_BYTES = 25 * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = 20;
export const MAX_ZIP_UPLOAD_BYTES = 250 * 1024 * 1024;

export type SupportedImageMimeType = (typeof supportedImageMimeTypes)[number];

export function getDetectedImageMimeType(content: Buffer): SupportedImageMimeType | null {
  if (content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    content.length >= 8 &&
    content[0] === 0x89 &&
    content[1] === 0x50 &&
    content[2] === 0x4e &&
    content[3] === 0x47 &&
    content[4] === 0x0d &&
    content[5] === 0x0a &&
    content[6] === 0x1a &&
    content[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    content.length >= 12 &&
    content.subarray(0, 4).toString("ascii") === "RIFF" &&
    content.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

export function safeImageFilename(originalName: string, mimeType: SupportedImageMimeType) {
  const extension = mimeType === "image/jpeg" ? ".jpg" : mimeType === "image/png" ? ".png" : ".webp";
  const basename = originalName
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 100);

  return `${basename || "image"}${extension}`;
}

export function formatByteSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
