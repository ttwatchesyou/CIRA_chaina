export type ModelFileKind = "best" | "last" | "results";

export type ModelFileItem = {
  kind: ModelFileKind;
  label: string;
  fileName: string;
  sizeBytes: number;
  downloadUrl: string;
  isCheckpoint: boolean;
};

export type ModelItem = {
  id: string;
  name: string;
  archiveFileName: string;
  archiveDownloadUrl: string;
  baseModel: string;
  createdAt: string;
  map50: number | null;
  map50_95: number | null;
  simulation: boolean;
  trainingJob: {
    id: string;
    epochs: number;
    imageSize: number;
    batchSize: number;
    completedAt: string | null;
    workerName: string | null;
    datasets: Array<{ id: string; version: number; name: string }>;
  };
  files: ModelFileItem[];
};

export type ModelsWorkspaceData = {
  projectId: string;
  models: ModelItem[];
};
