export type DatasetVersionItem = {
  id: string;
  version: number;
  name: string;
  format: "YOLO";
  status: "READY" | "GENERATING" | "FAILED";
  imageResizeMode: "ORIGINAL" | "LETTERBOX";
  imageSize: 120 | 320 | 640 | null;
  trainPercent: number;
  validationPercent: number;
  testPercent: number;
  byteSize: number;
  imageCount: number;
  trainImageCount: number;
  validationImageCount: number;
  testImageCount: number;
  classCount: number;
  annotationCount: number;
  createdAt: string;
  trainingJobCount: number;
};

export type DatasetWorkspaceData = {
  projectId: string;
  projectName: string;
  annotatedImageCount: number;
  annotationCount: number;
  classCount: number;
  nextVersion: number;
  datasets: DatasetVersionItem[];
};

export type GenerateDatasetInput = {
  name: string;
  imageSize: 120 | 320 | 640 | null;
  trainPercent: number;
  validationPercent: number;
  testPercent: number;
};
