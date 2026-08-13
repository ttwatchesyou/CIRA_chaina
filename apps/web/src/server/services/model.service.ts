import path from "node:path";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  createStorageReadStream,
  createStorageZipFromEntries,
  modelArtifactFilePath,
  removeStorageFile,
  replaceStorageFile,
  storageFileStat,
} from "@/lib/storage";
import type { ModelFileItem, ModelFileKind, ModelItem, ModelsWorkspaceData } from "@/types/model";
import type { TrainingMetrics } from "@/types/training";

const modelInclude = {
  trainingJob: {
    select: {
      id: true,
      outputName: true,
      status: true,
      epochs: true,
      imageSize: true,
      batchSize: true,
      completedAt: true,
      metricsJson: true,
      worker: { select: { hostname: true } },
      datasetVersion: { select: { id: true, version: true, name: true } },
      datasetEntries: {
        orderBy: { sortOrder: "asc" },
        select: { datasetVersion: { select: { id: true, version: true, name: true } } },
      },
    },
  },
} as const;

type ModelRecord = Prisma.ModelArtifactGetPayload<{ include: typeof modelInclude }>;

export class ModelServiceError extends Error {
  constructor(
    public readonly code: "WORKER_MISMATCH" | "JOB_NOT_READY" | "BEST_CHECKPOINT_REQUIRED" | "INVALID_ARTIFACT",
    message: string,
  ) {
    super(message);
  }
}

export async function getModelsWorkspace(projectId: string, userId: string): Promise<ModelsWorkspaceData | null> {
  const project = await prisma.project.findFirst({ where: { id: projectId, createdById: userId }, select: { id: true } });
  if (!project) return null;

  await backfillSimulationArtifacts(projectId);
  const records = await prisma.modelArtifact.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: modelInclude,
  });
  return { projectId, models: await Promise.all(records.map(serializeModel)) };
}

export async function ensureSimulationModelArtifact(trainingJobId: string) {
  const job = await prisma.trainingJob.findUnique({
    where: { id: trainingJobId },
    select: {
      id: true,
      projectId: true,
      outputName: true,
      status: true,
      baseModel: true,
      epochs: true,
      imageSize: true,
      batchSize: true,
      device: true,
      metricsJson: true,
      completedAt: true,
      model: { select: { id: true } },
      worker: { select: { hostname: true } },
      datasetVersion: { select: { id: true, version: true, name: true } },
      datasetEntries: {
        orderBy: { sortOrder: "asc" },
        select: { datasetVersion: { select: { id: true, version: true, name: true } } },
      },
    },
  });
  if (!job || job.status !== "COMPLETED" || job.model) return job?.model ?? null;

  const metrics = parseMetrics(job.metricsJson);
  const datasets = job.datasetEntries.length > 0
    ? job.datasetEntries.map((entry) => entry.datasetVersion)
    : [job.datasetVersion];
  const storagePath = modelArtifactFilePath(job.projectId, job.id, "simulation-summary.json");
  const summary = {
    notice: "ไฟล์นี้เป็นรายงานจาก Simulation mode ไม่ใช่ PyTorch checkpoint และนำไป Predict ไม่ได้",
    trainingJobId: job.id,
    outputName: job.outputName || `model-${job.id.slice(0, 8)}`,
    baseModel: job.baseModel,
    configuration: { epochs: job.epochs, imageSize: job.imageSize, batchSize: job.batchSize, device: job.device },
    datasets,
    worker: job.worker?.hostname ?? null,
    metrics,
    completedAt: job.completedAt?.toISOString() ?? null,
  };
  await replaceStorageFile(storagePath, Buffer.from(`${JSON.stringify(summary, null, 2)}\n`, "utf8"));

  try {
    return await prisma.$transaction(async (transaction) => {
      const model = await transaction.modelArtifact.create({
        data: {
          projectId: job.projectId,
          trainingJobId: job.id,
          name: job.outputName || `${displayBaseModel(job.baseModel)} · รายงาน Simulation`,
          baseModel: job.baseModel,
          storagePath,
          map50: metrics.map50,
          map50_95: metrics.map50_95,
        },
      });
      await transaction.activityLog.create({
        data: { projectId: job.projectId, type: "MODEL_CREATED", message: `สร้างรายงาน Model จากงาน ${job.id}` },
      });
      return model;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return prisma.modelArtifact.findUnique({ where: { trainingJobId: job.id } });
    }
    throw error;
  }
}

export async function saveModelArtifactFromWorker(input: {
  workerKey: string;
  trainingJobId: string;
  kind: ModelFileKind;
  fileName: string;
  modelName?: string | null;
  content: Buffer;
}) {
  if (input.content.length === 0) throw new ModelServiceError("INVALID_ARTIFACT", "ไฟล์ Model ว่างเปล่า");
  const job = await prisma.trainingJob.findUnique({
    where: { id: input.trainingJobId },
    select: {
      id: true,
      projectId: true,
      outputName: true,
      status: true,
      baseModel: true,
      metricsJson: true,
      worker: { select: { workerKey: true } },
      model: { select: { id: true, storagePath: true } },
    },
  });
  if (!job) return null;
  if (job.worker?.workerKey !== input.workerKey) throw new ModelServiceError("WORKER_MISMATCH", "งานนี้ไม่ได้ถูกมอบหมายให้ Worker เครื่องนี้");
  if (["QUEUED", "FAILED", "CANCELLED"].includes(job.status)) throw new ModelServiceError("JOB_NOT_READY", "สถานะงานนี้ยังบันทึก Model ไม่ได้");

  const safeFileName = safeArtifactFileName(input.fileName);
  const storagePath = modelArtifactFilePath(job.projectId, job.id, `${input.kind}-${safeFileName}`);
  await replaceStorageFile(storagePath, input.content);
  const metrics = parseMetrics(job.metricsJson);

  if (input.kind === "best") {
    const model = await prisma.modelArtifact.upsert({
      where: { trainingJobId: job.id },
      create: {
        projectId: job.projectId,
        trainingJobId: job.id,
        name: input.modelName?.trim().slice(0, 120) || job.outputName || `${displayBaseModel(job.baseModel)} · best checkpoint`,
        baseModel: job.baseModel,
        storagePath,
        map50: metrics.map50,
        map50_95: metrics.map50_95,
      },
      update: {
        name: input.modelName?.trim().slice(0, 120) || job.outputName || `${displayBaseModel(job.baseModel)} · best checkpoint`,
        storagePath,
        map50: metrics.map50,
        map50_95: metrics.map50_95,
      },
    });
    if (job.model?.storagePath && job.model.storagePath !== storagePath) await removeStorageFile(job.model.storagePath);
    return model;
  }

  if (!job.model) {
    await removeStorageFile(storagePath);
    throw new ModelServiceError("BEST_CHECKPOINT_REQUIRED", "ต้องอัปโหลด best checkpoint ก่อนไฟล์อื่น");
  }
  return prisma.modelArtifact.update({
    where: { id: job.model.id },
    data: input.kind === "last" ? { lastCheckpointPath: storagePath } : { resultsPath: storagePath },
  });
}

export async function getModelDownload(modelId: string, userId: string, kind: ModelFileKind) {
  const model = await prisma.modelArtifact.findFirst({
    where: { id: modelId, project: { createdById: userId } },
    select: { id: true, name: true, storagePath: true, lastCheckpointPath: true, resultsPath: true },
  });
  if (!model) return null;
  const storagePath = kind === "last" ? model.lastCheckpointPath : kind === "results" ? model.resultsPath : model.storagePath;
  if (!storagePath) return null;
  const fileStat = await storageFileStat(storagePath).catch(() => null);
  if (!fileStat?.isFile()) return null;
  const extension = path.extname(storagePath).toLowerCase();
  return {
    stream: createStorageReadStream(storagePath),
    size: fileStat.size,
    contentType: contentTypeForExtension(extension),
    fileName: `${safeDownloadName(model.name)}-${kind}${extension || ".bin"}`,
  };
}

export async function getModelArchive(modelId: string, userId: string) {
  const model = await prisma.modelArtifact.findFirst({
    where: { id: modelId, project: { createdById: userId } },
    include: modelInclude,
  });
  if (!model) return null;

  const outputName = model.trainingJob.outputName || model.name || `model-${model.trainingJob.id.slice(0, 8)}`;
  const root = safeArchiveFolderName(outputName);
  const files: Array<{ storagePath: string; archivePath: string }> = [];
  const bestExtension = path.extname(model.storagePath).toLowerCase();
  const simulation = ![".pt", ".onnx", ".engine"].includes(bestExtension);
  files.push({
    storagePath: model.storagePath,
    archivePath: simulation ? `${root}/simulation-summary${bestExtension || ".json"}` : `${root}/weights/best${bestExtension}`,
  });
  if (model.lastCheckpointPath) {
    const extension = path.extname(model.lastCheckpointPath).toLowerCase() || ".pt";
    files.push({ storagePath: model.lastCheckpointPath, archivePath: `${root}/weights/last${extension}` });
  }
  if (model.resultsPath) {
    const resultName = cleanArchiveFileName(path.posix.basename(model.resultsPath));
    files.push({ storagePath: model.resultsPath, archivePath: `${root}/results/${resultName}` });
  }

  const datasets = model.trainingJob.datasetEntries.length > 0
    ? model.trainingJob.datasetEntries.map((entry) => entry.datasetVersion)
    : [model.trainingJob.datasetVersion];
  const metadata = {
    name: outputName,
    simulation,
    baseModel: model.baseModel,
    trainingJobId: model.trainingJob.id,
    configuration: {
      epochs: model.trainingJob.epochs,
      imageSize: model.trainingJob.imageSize,
      batchSize: model.trainingJob.batchSize,
    },
    datasets,
    worker: model.trainingJob.worker?.hostname ?? null,
    metrics: { map50: model.map50, map50_95: model.map50_95 },
    completedAt: model.trainingJob.completedAt?.toISOString() ?? null,
  };
  const readme = simulation
    ? "ผลลัพธ์ชุดนี้มาจาก Simulation mode\nจึงไม่มี weights/best.pt และไม่สามารถนำไป Predict ได้\nไฟล์ simulation-summary.json ใช้ตรวจการตั้งค่าและทดสอบระบบ Queue เท่านั้น\n"
    : "โครงสร้างผลลัพธ์จาก Internal Vision Platform\nweights/best.pt คือ Checkpoint ที่แนะนำให้นำไป Predict หรือเทรนต่อ\nweights/last.pt คือ Checkpoint จาก Epoch สุดท้าย (ถ้ามี)\nดูการตั้งค่าและ Metrics เพิ่มเติมใน model-info.json\n";
  const argsYaml = [
    `model: ${JSON.stringify(model.baseModel)}`,
    `epochs: ${model.trainingJob.epochs}`,
    `imgsz: ${model.trainingJob.imageSize}`,
    `batch: ${model.trainingJob.batchSize}`,
    `name: ${JSON.stringify(outputName)}`,
    `simulation: ${simulation}`,
    "",
  ].join("\n");
  const metricsJson = `${JSON.stringify({ map50: model.map50, map50_95: model.map50_95 }, null, 2)}\n`;
  const stream = await createStorageZipFromEntries(files, [
    { archivePath: `${root}/model-info.json`, content: Buffer.from(`${JSON.stringify(metadata, null, 2)}\n`, "utf8") },
    { archivePath: `${root}/args.yaml`, content: Buffer.from(argsYaml, "utf8") },
    { archivePath: `${root}/results/metrics.json`, content: Buffer.from(metricsJson, "utf8") },
    { archivePath: `${root}/README.txt`, content: Buffer.from(readme, "utf8") },
  ]);
  return { stream, fileName: `${root}.zip` };
}

async function backfillSimulationArtifacts(projectId: string) {
  const jobs = await prisma.trainingJob.findMany({
    where: { projectId, status: "COMPLETED", model: null },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  for (const job of jobs) await ensureSimulationModelArtifact(job.id);
}

async function serializeModel(record: ModelRecord): Promise<ModelItem> {
  const datasets = record.trainingJob.datasetEntries.length > 0
    ? record.trainingJob.datasetEntries.map((entry) => entry.datasetVersion)
    : [record.trainingJob.datasetVersion];
  const files = (await Promise.all([
    serializeFile(record.id, "best", record.storagePath),
    serializeFile(record.id, "last", record.lastCheckpointPath),
    serializeFile(record.id, "results", record.resultsPath),
  ])).filter((file): file is ModelFileItem => Boolean(file));

  return {
    id: record.id,
    name: record.trainingJob.outputName || record.name,
    archiveFileName: `${safeArchiveFolderName(record.trainingJob.outputName || record.name)}.zip`,
    archiveDownloadUrl: `/api/models/${record.id}/download`,
    baseModel: record.baseModel,
    createdAt: record.createdAt.toISOString(),
    map50: record.map50,
    map50_95: record.map50_95,
    simulation: !files.some((file) => file.isCheckpoint),
    trainingJob: {
      id: record.trainingJob.id,
      epochs: record.trainingJob.epochs,
      imageSize: record.trainingJob.imageSize,
      batchSize: record.trainingJob.batchSize,
      completedAt: record.trainingJob.completedAt?.toISOString() ?? null,
      workerName: record.trainingJob.worker?.hostname ?? null,
      datasets,
    },
    files,
  };
}

async function serializeFile(modelId: string, kind: ModelFileKind, storagePath: string | null): Promise<ModelFileItem | null> {
  if (!storagePath) return null;
  const fileStat = await storageFileStat(storagePath).catch(() => null);
  if (!fileStat?.isFile()) return null;
  const fileName = path.posix.basename(storagePath);
  const isCheckpoint = [".pt", ".onnx", ".engine"].includes(path.extname(fileName).toLowerCase());
  const labels: Record<ModelFileKind, string> = { best: isCheckpoint ? "Best checkpoint" : "รายงาน Simulation", last: "Last checkpoint", results: "ผลการ Train" };
  return { kind, label: labels[kind], fileName, sizeBytes: fileStat.size, downloadUrl: `/api/models/${modelId}/download?file=${kind}`, isCheckpoint };
}

function parseMetrics(value: string | null): TrainingMetrics {
  if (!value) return {};
  try {
    return JSON.parse(value) as TrainingMetrics;
  } catch {
    return {};
  }
}

function safeArtifactFileName(value: string) {
  const baseName = path.basename(value).normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
  if (!baseName || baseName === "." || baseName === "..") throw new ModelServiceError("INVALID_ARTIFACT", "ชื่อไฟล์ Model ไม่ถูกต้อง");
  return baseName;
}

function safeDownloadName(value: string) {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "model";
}

function safeArchiveFolderName(value: string) {
  const safe = value.normalize("NFKC").replace(/[^\p{L}\p{N} ._-]+/gu, "-").trim().replace(/[ .]+$/g, "").slice(0, 80);
  return safe && safe !== "." && safe !== ".." ? safe : "model";
}

function cleanArchiveFileName(value: string) {
  const safe = value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
  return safe || "results.bin";
}

function displayBaseModel(value: string) {
  return value.replace(/\.(pt|onnx|engine)$/i, "").toUpperCase();
}

function contentTypeForExtension(extension: string) {
  if (extension === ".json") return "application/json; charset=utf-8";
  if (extension === ".csv") return "text/csv; charset=utf-8";
  if (extension === ".zip") return "application/zip";
  return "application/octet-stream";
}
