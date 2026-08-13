import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { appendStorageFile, trainingJobLogPath } from "@/lib/storage";
import { ensureSimulationModelArtifact } from "@/server/services/model.service";
import { removeTrainingDatasetBundle } from "@/server/services/training-dataset.service";
import type {
  CreateTrainingJobInput,
  TrainingJobItem,
  TrainingJobStatus,
  TrainingMetrics,
  TrainingWorkerItem,
  TrainingWorkspaceData,
  WorkerStatus,
} from "@/types/training";

const WORKER_OFFLINE_AFTER_MS = 30_000;
const ACTIVE_JOB_STATUSES = ["QUEUED", "PREPARING", "DOWNLOADING_DATASET", "TRAINING", "VALIDATING", "SAVING_MODEL"];
const TERMINAL_JOB_STATUSES = new Set<TrainingJobStatus>(["COMPLETED", "FAILED", "CANCELLED"]);

const workerSelect = {
  id: true,
  workerKey: true,
  hostname: true,
  ipAddress: true,
  status: true,
  cpu: true,
  cpuUsage: true,
  ramTotalMb: true,
  ramUsedMb: true,
  gpu: true,
  gpuMemoryMb: true,
  gpuMemoryUsedMb: true,
  os: true,
  agentVersion: true,
  lastError: true,
  lastHeartbeatAt: true,
} as const;

const trainingJobInclude = {
  datasetVersion: { select: { id: true, version: true, name: true, imageCount: true } },
  datasetEntries: {
    orderBy: { sortOrder: "asc" },
    select: { datasetVersion: { select: { id: true, version: true, name: true, imageCount: true } } },
  },
  worker: { select: { id: true, hostname: true, status: true } },
  logs: { orderBy: { createdAt: "desc" }, take: 50 },
} as const;

type WorkerRecord = Prisma.WorkerGetPayload<{ select: typeof workerSelect }>;
type TrainingJobRecord = Prisma.TrainingJobGetPayload<{ include: typeof trainingJobInclude }>;

export type WorkerRegistrationInput = {
  workerKey: string;
  hostname: string;
  ipAddress?: string | null;
  cpu?: string | null;
  ramTotalMb?: number | null;
  gpu?: string | null;
  gpuMemoryMb?: number | null;
  os?: string | null;
  agentVersion?: string | null;
  capabilities?: Record<string, unknown> | null;
};

export type WorkerHeartbeatInput = {
  workerKey: string;
  status?: "IDLE" | "BUSY" | "ERROR";
  cpuUsage?: number | null;
  ramUsedMb?: number | null;
  gpuMemoryUsedMb?: number | null;
  lastError?: string | null;
};

export type WorkerJobEventInput = {
  status: TrainingJobStatus;
  currentEpoch?: number;
  progress?: number;
  metrics?: TrainingMetrics;
  message?: string;
  level?: "INFO" | "WARNING" | "ERROR";
  errorMessage?: string | null;
};

export class TrainingServiceError extends Error {
  constructor(
    public readonly code: "DATASET_NOT_READY" | "WORKER_NOT_AVAILABLE" | "JOB_NOT_CONTROLLABLE" | "WORKER_MISMATCH",
    message: string,
  ) {
    super(message);
  }
}

export async function markStaleWorkersOffline() {
  const staleBefore = new Date(Date.now() - WORKER_OFFLINE_AFTER_MS);
  await prisma.worker.updateMany({
    where: { status: { not: "OFFLINE" }, OR: [{ lastHeartbeatAt: null }, { lastHeartbeatAt: { lt: staleBefore } }] },
    data: { status: "OFFLINE" },
  });
}

export async function listTrainingWorkers() {
  await markStaleWorkersOffline();
  const workers = await prisma.worker.findMany({ orderBy: [{ status: "asc" }, { hostname: "asc" }], select: workerSelect });
  return workers.map(serializeWorker);
}

export async function registerTrainingWorker(input: WorkerRegistrationInput) {
  const now = new Date();
  const worker = await prisma.worker.upsert({
    where: { workerKey: input.workerKey },
    create: {
      workerKey: input.workerKey,
      hostname: input.hostname,
      ipAddress: input.ipAddress,
      status: "IDLE",
      cpu: input.cpu,
      ramTotalMb: input.ramTotalMb,
      gpu: input.gpu,
      gpuMemoryMb: input.gpuMemoryMb,
      os: input.os,
      agentVersion: input.agentVersion,
      capabilitiesJson: input.capabilities ? JSON.stringify(input.capabilities) : null,
      lastHeartbeatAt: now,
    },
    update: {
      hostname: input.hostname,
      ipAddress: input.ipAddress,
      status: "IDLE",
      cpu: input.cpu,
      ramTotalMb: input.ramTotalMb,
      gpu: input.gpu,
      gpuMemoryMb: input.gpuMemoryMb,
      os: input.os,
      agentVersion: input.agentVersion,
      capabilitiesJson: input.capabilities ? JSON.stringify(input.capabilities) : null,
      lastError: null,
      lastHeartbeatAt: now,
    },
    select: workerSelect,
  });
  return serializeWorker(worker);
}

export async function heartbeatTrainingWorker(input: WorkerHeartbeatInput) {
  const worker = await prisma.worker.findUnique({ where: { workerKey: input.workerKey }, select: { id: true } });
  if (!worker) return null;

  const currentJob = await prisma.trainingJob.findFirst({
    where: { workerId: worker.id, status: { in: ACTIVE_JOB_STATUSES } },
    orderBy: { createdAt: "asc" },
    select: { id: true, status: true, cancelRequestedAt: true },
  });
  const status = input.status === "ERROR" ? "ERROR" : currentJob ? "BUSY" : "IDLE";
  const updated = await prisma.worker.update({
    where: { id: worker.id },
    data: {
      status,
      cpuUsage: input.cpuUsage,
      ramUsedMb: input.ramUsedMb,
      gpuMemoryUsedMb: input.gpuMemoryUsedMb,
      lastError: input.lastError,
      lastHeartbeatAt: new Date(),
    },
    select: workerSelect,
  });

  return {
    worker: serializeWorker(updated),
    currentJob: currentJob ? { ...currentJob, cancelRequested: Boolean(currentJob.cancelRequestedAt) } : null,
  };
}

export async function getTrainingWorkspace(projectId: string, userId: string): Promise<TrainingWorkspaceData | null> {
  await markStaleWorkersOffline();
  const project = await prisma.project.findFirst({ where: { id: projectId, createdById: userId }, select: { id: true } });
  if (!project) return null;

  const [datasets, workers, jobs] = await Promise.all([
    prisma.datasetVersion.findMany({
      where: { projectId, status: "READY" },
      orderBy: { version: "desc" },
      select: { id: true, version: true, name: true, imageCount: true, imageSize: true },
    }),
    prisma.worker.findMany({ orderBy: [{ status: "asc" }, { hostname: "asc" }], select: workerSelect }),
    prisma.trainingJob.findMany({ where: { projectId }, orderBy: { createdAt: "desc" }, take: 30, include: trainingJobInclude }),
  ]);

  return { projectId, datasets, workers: workers.map(serializeWorker), jobs: jobs.map(serializeTrainingJob) };
}

export async function createTrainingJob(projectId: string, userId: string, input: CreateTrainingJobInput, retryOfJobId?: string) {
  await markStaleWorkersOffline();
  const datasetVersionIds = [...new Set(input.datasetVersionIds)];
  const [datasetRecords, worker] = await Promise.all([
    prisma.datasetVersion.findMany({
      where: { id: { in: datasetVersionIds }, projectId, project: { createdById: userId }, status: "READY" },
      select: { id: true, version: true, name: true },
    }),
    prisma.worker.findUnique({ where: { id: input.workerId }, select: { id: true, status: true } }),
  ]);
  const datasetById = new Map(datasetRecords.map((dataset) => [dataset.id, dataset]));
  const datasets = datasetVersionIds.map((id) => datasetById.get(id)).filter((dataset): dataset is NonNullable<typeof dataset> => Boolean(dataset));
  if (datasets.length !== datasetVersionIds.length || datasets.length === 0) {
    throw new TrainingServiceError("DATASET_NOT_READY", "มี Dataset บางรายการไม่พร้อมใช้สำหรับ Train");
  }
  if (!worker || worker.status === "OFFLINE" || worker.status === "ERROR") {
    throw new TrainingServiceError("WORKER_NOT_AVAILABLE", "เครื่อง Worker ยังไม่พร้อมใช้งาน");
  }

  const primaryDataset = datasets[0];
  if (!primaryDataset) throw new TrainingServiceError("DATASET_NOT_READY", "กรุณาเลือก Dataset อย่างน้อย 1 รายการ");
  const datasetLabel = datasets.map((dataset) => `v${dataset.version}`).join(", ");
  const jobId = randomUUID();
  const created = await prisma.$transaction(async (transaction) => {
    const job = await transaction.trainingJob.create({
      data: {
        id: jobId,
        projectId,
        datasetVersionId: primaryDataset.id,
        datasetEntries: { create: datasets.map((dataset, sortOrder) => ({ datasetVersionId: dataset.id, sortOrder })) },
        workerId: worker.id,
        outputName: input.outputName,
        baseModel: input.baseModel,
        epochs: input.epochs,
        imageSize: input.imageSize,
        batchSize: input.batchSize,
        device: input.device,
        status: "QUEUED",
        lastMessage: "รอ Worker รับงาน",
        logPath: trainingJobLogPath(jobId),
        retryOfJobId,
      },
      include: trainingJobInclude,
    });
    await transaction.worker.update({ where: { id: worker.id }, data: { status: "BUSY" } });
    await transaction.trainingJobLog.create({ data: { trainingJobId: job.id, message: `สร้างงาน Train ด้วย ${input.baseModel} และ Dataset ${datasetLabel}` } });
    await transaction.activityLog.create({
      data: { projectId, type: "TRAINING_QUEUED", message: `Queued training ${input.baseModel} with Dataset ${datasetLabel}`, metadata: JSON.stringify({ jobId: job.id, workerId: worker.id, datasetVersionIds }) },
    });
    return job;
  });
  await appendLogFile(created.id, "INFO", "สร้างงานและรอ Worker รับงาน");
  return reloadTrainingJob(created.id);
}

export async function getTrainingJob(jobId: string, userId: string) {
  const job = await prisma.trainingJob.findFirst({
    where: { id: jobId, project: { createdById: userId } },
    include: trainingJobInclude,
  });
  return job ? serializeTrainingJob(job) : null;
}

export async function cancelTrainingJob(jobId: string, userId: string) {
  const job = await prisma.trainingJob.findFirst({
    where: { id: jobId, project: { createdById: userId } },
    select: { id: true, projectId: true, status: true, workerId: true },
  });
  if (!job) return null;
  if (TERMINAL_JOB_STATUSES.has(job.status as TrainingJobStatus)) {
    throw new TrainingServiceError("JOB_NOT_CONTROLLABLE", "งานนี้จบแล้ว จึงยกเลิกไม่ได้");
  }

  const now = new Date();
  const queued = job.status === "QUEUED";
  await prisma.$transaction(async (transaction) => {
    await transaction.trainingJob.update({
      where: { id: job.id },
      data: queued
        ? { status: "CANCELLED", cancelRequestedAt: now, completedAt: now, lastMessage: "ยกเลิกก่อน Worker เริ่มงาน" }
        : { cancelRequestedAt: now, lastMessage: "ส่งคำขอยกเลิกไปยัง Worker แล้ว" },
    });
    await transaction.trainingJobLog.create({ data: { trainingJobId: job.id, level: "WARNING", message: queued ? "ยกเลิกงานในคิวแล้ว" : "ผู้ใช้ขอยกเลิกงาน" } });
    if (queued && job.workerId) await transaction.worker.update({ where: { id: job.workerId }, data: { status: "IDLE" } });
  });
  await appendLogFile(job.id, "WARNING", queued ? "ยกเลิกงานในคิวแล้ว" : "ผู้ใช้ขอยกเลิกงาน");
  return reloadTrainingJob(job.id);
}

export async function retryTrainingJob(jobId: string, userId: string) {
  const source = await prisma.trainingJob.findFirst({
    where: { id: jobId, project: { createdById: userId } },
    select: {
      id: true,
      projectId: true,
      datasetVersionId: true,
      datasetEntries: { orderBy: { sortOrder: "asc" }, select: { datasetVersionId: true } },
      workerId: true,
      outputName: true,
      baseModel: true,
      epochs: true,
      imageSize: true,
      batchSize: true,
      device: true,
      status: true,
    },
  });
  if (!source) return null;
  if (!source.workerId || !["FAILED", "CANCELLED"].includes(source.status)) {
    throw new TrainingServiceError("JOB_NOT_CONTROLLABLE", "Retry ได้เฉพาะงานที่ล้มเหลวหรือถูกยกเลิก");
  }
  return createTrainingJob(source.projectId, userId, {
    datasetVersionIds: source.datasetEntries.length > 0 ? source.datasetEntries.map((entry) => entry.datasetVersionId) : [source.datasetVersionId],
    workerId: source.workerId,
    outputName: retryOutputName(source.outputName),
    baseModel: source.baseModel,
    epochs: source.epochs,
    imageSize: source.imageSize,
    batchSize: source.batchSize,
    device: source.device,
  }, source.id);
}

export async function claimTrainingJob(workerKey: string) {
  const result = await prisma.$transaction(async (transaction) => {
    const worker = await transaction.worker.findUnique({ where: { workerKey }, select: { id: true } });
    if (!worker) return null;
    const active = await transaction.trainingJob.findFirst({
      where: { workerId: worker.id, status: { in: ACTIVE_JOB_STATUSES.filter((status) => status !== "QUEUED") } },
      orderBy: { createdAt: "asc" },
      include: trainingJobInclude,
    });
    if (active) return { job: active, claimed: false };

    const queued = await transaction.trainingJob.findFirst({
      where: { workerId: worker.id, status: "QUEUED" },
      orderBy: { createdAt: "asc" },
      select: { id: true, projectId: true },
    });
    if (!queued) {
      await transaction.worker.update({ where: { id: worker.id }, data: { status: "IDLE", lastHeartbeatAt: new Date() } });
      return { job: null, claimed: false };
    }

    const updated = await transaction.trainingJob.update({
      where: { id: queued.id },
      data: { status: "PREPARING", startedAt: new Date(), lastMessage: "Worker รับงานแล้ว" },
      include: trainingJobInclude,
    });
    await transaction.worker.update({ where: { id: worker.id }, data: { status: "BUSY", lastHeartbeatAt: new Date() } });
    await transaction.trainingJobLog.create({ data: { trainingJobId: queued.id, message: "Worker รับงานแล้ว" } });
    await transaction.activityLog.create({ data: { projectId: queued.projectId, type: "TRAINING_STARTED", message: `Training job ${queued.id} started` } });
    return { job: updated, claimed: true };
  });
  if (result?.job && result.claimed) await appendLogFile(result.job.id, "INFO", "Worker รับงานแล้ว");
  return result?.job ? serializeTrainingJob(result.job) : null;
}

export async function updateTrainingJobFromWorker(workerKey: string, jobId: string, input: WorkerJobEventInput) {
  const existing = await prisma.trainingJob.findUnique({
    where: { id: jobId },
    select: { id: true, projectId: true, worker: { select: { id: true, workerKey: true } }, status: true, epochs: true, cancelRequestedAt: true },
  });
  if (!existing) return null;
  if (existing.worker?.workerKey !== workerKey) throw new TrainingServiceError("WORKER_MISMATCH", "งานนี้ไม่ได้ถูกมอบหมายให้ Worker เครื่องนี้");
  if (TERMINAL_JOB_STATUSES.has(existing.status as TrainingJobStatus)) {
    if (existing.status === "COMPLETED") await ensureSimulationModelArtifact(existing.id);
    return reloadTrainingJob(existing.id);
  }

  const now = new Date();
  const terminal = TERMINAL_JOB_STATUSES.has(input.status);
  const currentEpoch = Math.min(Math.max(input.currentEpoch ?? 0, 0), existing.epochs);
  const progress = input.status === "COMPLETED"
    ? 100
    : Math.min(Math.max(input.progress ?? (currentEpoch / existing.epochs) * 100, 0), 99.9);
  const message = input.message || statusLabel(input.status);

  await prisma.$transaction(async (transaction) => {
    await transaction.trainingJob.update({
      where: { id: existing.id },
      data: {
        status: input.status,
        currentEpoch,
        progress,
        metricsJson: input.metrics ? JSON.stringify(input.metrics) : undefined,
        lastMessage: message,
        errorMessage: input.status === "FAILED" ? input.errorMessage || message : input.errorMessage,
        completedAt: terminal ? now : undefined,
      },
    });
    await transaction.trainingJobLog.create({ data: { trainingJobId: existing.id, level: input.level || (input.status === "FAILED" ? "ERROR" : "INFO"), message } });
    if (terminal && existing.worker) await transaction.worker.update({ where: { id: existing.worker.id }, data: { status: "IDLE", lastError: input.status === "FAILED" ? input.errorMessage || message : null } });
    if (terminal) {
      await transaction.activityLog.create({
        data: { projectId: existing.projectId, type: `TRAINING_${input.status}`, message: `Training job ${existing.id} ${input.status.toLowerCase()}` },
      });
    }
  });
  await appendLogFile(existing.id, input.level || (input.status === "FAILED" ? "ERROR" : "INFO"), message);
  if (terminal) await removeTrainingDatasetBundle(existing.id);
  if (input.status === "COMPLETED") await ensureSimulationModelArtifact(existing.id);
  const job = await reloadTrainingJob(existing.id);
  return job ? { job, cancelRequested: Boolean(existing.cancelRequestedAt) } : null;
}

async function reloadTrainingJob(jobId: string) {
  const job = await prisma.trainingJob.findUnique({ where: { id: jobId }, include: trainingJobInclude });
  return job ? serializeTrainingJob(job) : null;
}

async function appendLogFile(jobId: string, level: string, message: string) {
  const timestamp = new Date().toISOString();
  await appendStorageFile(trainingJobLogPath(jobId), `[${timestamp}] [${level}] ${message}\n`).catch(() => undefined);
}

function serializeWorker(worker: WorkerRecord): TrainingWorkerItem {
  const status = (["OFFLINE", "IDLE", "BUSY", "ERROR"] as const).includes(worker.status as WorkerStatus)
    ? worker.status as WorkerStatus
    : "OFFLINE";
  return {
    ...worker,
    status,
    lastHeartbeatAt: worker.lastHeartbeatAt?.toISOString() ?? null,
  };
}

function serializeTrainingJob(job: TrainingJobRecord): TrainingJobItem {
  const status = isTrainingJobStatus(job.status) ? job.status : "FAILED";
  const datasets = job.datasetEntries.length > 0
    ? job.datasetEntries.map((entry) => entry.datasetVersion)
    : [job.datasetVersion];
  return {
    id: job.id,
    outputName: job.outputName || `model-${job.id.slice(0, 8)}`,
    status,
    baseModel: job.baseModel,
    epochs: job.epochs,
    imageSize: job.imageSize,
    batchSize: job.batchSize,
    device: job.device,
    currentEpoch: job.currentEpoch,
    progress: job.progress,
    metrics: parseMetrics(job.metricsJson),
    lastMessage: job.lastMessage,
    errorMessage: job.errorMessage,
    cancelRequestedAt: job.cancelRequestedAt?.toISOString() ?? null,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    dataset: {
      id: job.datasetVersion.id,
      version: job.datasetVersion.version,
      name: job.datasetVersion.name,
      imageCount: job.datasetVersion.imageCount,
    },
    datasets,
    worker: job.worker ? {
      id: job.worker.id,
      hostname: job.worker.hostname,
      status: (["OFFLINE", "IDLE", "BUSY", "ERROR"] as const).includes(job.worker.status as WorkerStatus) ? job.worker.status as WorkerStatus : "OFFLINE",
    } : null,
    logs: [...job.logs].reverse().map((log) => ({
      id: log.id,
      level: log.level === "ERROR" ? "ERROR" : log.level === "WARNING" ? "WARNING" : "INFO",
      message: log.message,
      createdAt: log.createdAt.toISOString(),
    })),
  };
}

function parseMetrics(value: string | null): TrainingMetrics {
  if (!value) return {};
  try {
    return JSON.parse(value) as TrainingMetrics;
  } catch {
    return {};
  }
}

function isTrainingJobStatus(value: string): value is TrainingJobStatus {
  return ["QUEUED", "PREPARING", "DOWNLOADING_DATASET", "TRAINING", "VALIDATING", "SAVING_MODEL", "COMPLETED", "FAILED", "CANCELLED"].includes(value);
}

function statusLabel(status: TrainingJobStatus) {
  const labels: Record<TrainingJobStatus, string> = {
    QUEUED: "รอในคิว",
    PREPARING: "กำลังเตรียมงาน",
    DOWNLOADING_DATASET: "กำลังดาวน์โหลด Dataset",
    TRAINING: "กำลัง Train โมเดล",
    VALIDATING: "กำลังตรวจ Validation",
    SAVING_MODEL: "กำลังบันทึกโมเดล",
    COMPLETED: "Train สำเร็จ",
    FAILED: "Train ไม่สำเร็จ",
    CANCELLED: "ยกเลิกงานแล้ว",
  };
  return labels[status];
}

function retryOutputName(value: string | null) {
  const base = value?.trim() || "model";
  return `${base.slice(0, 70)}-retry`;
}
