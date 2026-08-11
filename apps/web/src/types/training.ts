export type WorkerStatus = "OFFLINE" | "IDLE" | "BUSY" | "ERROR";

export type TrainingJobStatus =
  | "QUEUED"
  | "PREPARING"
  | "DOWNLOADING_DATASET"
  | "TRAINING"
  | "VALIDATING"
  | "SAVING_MODEL"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type TrainingMetrics = {
  loss?: number;
  boxLoss?: number;
  classLoss?: number;
  map50?: number;
  map50_95?: number;
  gpuUsage?: number;
  gpuMemoryUsedMb?: number;
  cpuUsage?: number;
  ramUsedMb?: number;
};

export type TrainingWorkerItem = {
  id: string;
  workerKey: string;
  hostname: string;
  ipAddress: string | null;
  status: WorkerStatus;
  cpu: string | null;
  cpuUsage: number | null;
  ramTotalMb: number | null;
  ramUsedMb: number | null;
  gpu: string | null;
  gpuMemoryMb: number | null;
  gpuMemoryUsedMb: number | null;
  os: string | null;
  agentVersion: string | null;
  lastError: string | null;
  lastHeartbeatAt: string | null;
};

export type TrainingJobLogItem = {
  id: string;
  level: "INFO" | "WARNING" | "ERROR";
  message: string;
  createdAt: string;
};

export type TrainingJobItem = {
  id: string;
  outputName: string;
  status: TrainingJobStatus;
  baseModel: string;
  epochs: number;
  imageSize: number;
  batchSize: number;
  device: string;
  currentEpoch: number;
  progress: number;
  metrics: TrainingMetrics;
  lastMessage: string | null;
  errorMessage: string | null;
  cancelRequestedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  dataset: { id: string; version: number; name: string; imageCount: number };
  datasets: Array<{ id: string; version: number; name: string; imageCount: number }>;
  worker: { id: string; hostname: string; status: WorkerStatus } | null;
  logs: TrainingJobLogItem[];
};

export type TrainingWorkspaceData = {
  projectId: string;
  datasets: Array<{ id: string; version: number; name: string; imageCount: number; imageSize: number | null }>;
  workers: TrainingWorkerItem[];
  jobs: TrainingJobItem[];
};

export type CreateTrainingJobInput = {
  datasetVersionIds: string[];
  workerId: string;
  outputName: string;
  baseModel: string;
  epochs: number;
  imageSize: number;
  batchSize: number;
  device: string;
};
