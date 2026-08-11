export type ImageStatus = "ANNOTATED" | "UNANNOTATED";

export type ImageLibraryItem = {
  id: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  status: ImageStatus;
  uploadedAt: string;
  fileUrl: string;
};

export type ImageLibraryPage = {
  images: ImageLibraryItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type UploadItemResult = {
  filename: string;
  status: "COMPLETE" | "DUPLICATE" | "FAILED";
  image?: ImageLibraryItem;
  message?: string;
};

export type UploadImagesResult = {
  items: UploadItemResult[];
  completed: number;
  duplicates: number;
  failed: number;
};
