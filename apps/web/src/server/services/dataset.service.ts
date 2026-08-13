import { createHash, randomUUID } from "node:crypto";
import path from "node:path";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { DatasetWorkspaceData, GenerateDatasetInput, DatasetVersionItem } from "@/types/dataset";
import {
  copyStorageFile,
  ensureStorageDirectory,
  readStorageFile,
  removeStorageDirectory,
  writeStorageFile,
  datasetVersionPath,
} from "@/lib/storage";

type DatasetSplit = "train" | "val" | "test";
type DatabaseSplit = "TRAIN" | "VALIDATION" | "TEST";
type BoxTransform = {
  sourceWidth: number;
  sourceHeight: number;
  resizedWidth: number;
  resizedHeight: number;
  offsetX: number;
  offsetY: number;
  targetSize: number;
};
const datasetSelect = {
  id: true,
  version: true,
  name: true,
  format: true,
  status: true,
  imageResizeMode: true,
  imageSize: true,
  trainPercent: true,
  validationPercent: true,
  testPercent: true,
  byteSize: true,
  imageCount: true,
  trainImageCount: true,
  validationImageCount: true,
  testImageCount: true,
  classCount: true,
  annotationCount: true,
  createdAt: true,
  _count: { select: { trainingJobEntries: true } },
} as const;

type DatasetRecord = Prisma.DatasetVersionGetPayload<{ select: typeof datasetSelect }>;

export class DatasetGenerationError extends Error {
  constructor(public readonly code: "NO_CLASSES" | "NO_ANNOTATED_IMAGES" | "VERSION_CONFLICT", message: string) {
    super(message);
  }
}

export async function getDatasetWorkspace(projectId: string, userId: string): Promise<DatasetWorkspaceData | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, createdById: userId },
    select: { id: true, name: true, nextDatasetVersion: true },
  });
  if (!project) return null;

  const [datasets, annotatedImageCount, annotationCount, classCount] = await Promise.all([
    prisma.datasetVersion.findMany({ where: { projectId }, orderBy: { version: "desc" }, select: datasetSelect }),
    prisma.image.count({ where: { projectId, annotations: { some: {} } } }),
    prisma.annotation.count({ where: { image: { projectId } } }),
    prisma.visionClass.count({ where: { projectId } }),
  ]);

  return {
    projectId: project.id,
    projectName: project.name,
    annotatedImageCount,
    annotationCount,
    classCount,
    nextVersion: project.nextDatasetVersion,
    datasets: datasets.map(serializeDataset),
  };
}

export async function generateDatasetVersion(projectId: string, userId: string, input: GenerateDatasetInput) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, createdById: userId },
    select: {
      id: true,
      name: true,
      nextDatasetVersion: true,
      classes: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, name: true, color: true },
      },
      images: {
        where: { annotations: { some: {} } },
        select: {
          id: true,
          filename: true,
          mimeType: true,
          originalPath: true,
          sha256: true,
          annotations: {
            select: { classId: true, x: true, y: true, width: true, height: true },
          },
        },
      },
    },
  });
  if (!project) return null;
  if (project.classes.length === 0) throw new DatasetGenerationError("NO_CLASSES", "สร้าง Class อย่างน้อย 1 รายการก่อนสร้าง Dataset");
  if (project.images.length === 0) throw new DatasetGenerationError("NO_ANNOTATED_IMAGES", "ทำ Annotation อย่างน้อย 1 รูปก่อนสร้าง Dataset");

  const version = project.nextDatasetVersion;
  const datasetId = randomUUID();
  const storagePath = datasetVersionPath(userId, datasetId);
  const createdAt = new Date();
  const classSnapshot = project.classes.map((visionClass, index) => ({ ...visionClass, index }));
  const classIndex = new Map(classSnapshot.map((visionClass) => [visionClass.id, visionClass.index]));
  const splitCounts = allocateSplitCounts(project.images.length, input);
  const sortedImages = [...project.images].sort((left, right) => {
    const leftScore = stableImageScore(project.id, left.sha256);
    const rightScore = stableImageScore(project.id, right.sha256);
    return leftScore.localeCompare(rightScore) || left.id.localeCompare(right.id);
  });
  const datasetImages: Array<{ imageId: string; split: DatabaseSplit; labelPath: string }> = [];
  let byteSize = 0;

  try {
    for (const split of ["train", "val", "test"] as const) {
      await ensureStorageDirectory(path.posix.join(storagePath, "images", split));
      await ensureStorageDirectory(path.posix.join(storagePath, "labels", split));
    }

    for (const [index, image] of sortedImages.entries()) {
      const split = splitForIndex(index, splitCounts);
      const databaseSplit = databaseSplitFor(split);
      const imageFileName = datasetImageFileName(image.filename, image.mimeType, image.id, index, input.imageSize);
      const imagePath = path.posix.join(storagePath, "images", split, imageFileName);
      const labelPath = path.posix.join(storagePath, "labels", split, `${path.parse(imageFileName).name}.txt`);
      const processedImage = await prepareDatasetImage(image.originalPath, imagePath, input.imageSize);
      byteSize += processedImage.byteSize;

      const labelLines = [...image.annotations]
        .sort((left, right) => (classIndex.get(left.classId) ?? 0) - (classIndex.get(right.classId) ?? 0) || left.x - right.x || left.y - right.y)
        .map((annotation) => annotationToYoloLine(annotation, classIndex, processedImage.transform));
      const labelContent = Buffer.from(labelLines.length > 0 ? `${labelLines.join("\n")}\n` : "", "utf8");
      await writeStorageFile(labelPath, labelContent);
      byteSize += labelContent.byteLength;
      datasetImages.push({ imageId: image.id, split: databaseSplit, labelPath });
    }

    const yamlContent = Buffer.from(createDataYaml(classSnapshot), "utf8");
    await writeStorageFile(path.posix.join(storagePath, "data.yaml"), yamlContent);
    byteSize += yamlContent.byteLength;

    const metadataContent = Buffer.from(`${JSON.stringify({
      project: { id: project.id, name: project.name },
      dataset: {
        id: datasetId,
        version,
        name: input.name,
        format: "YOLO",
        createdAt: createdAt.toISOString(),
        imageProcessing: input.imageSize ? { mode: "LETTERBOX", size: [input.imageSize, input.imageSize], background: [114, 114, 114], format: "JPEG", quality: 88 } : { mode: "ORIGINAL" },
      },
      splits: {
        percentages: { train: input.trainPercent, validation: input.validationPercent, test: input.testPercent },
        counts: splitCounts,
      },
      classes: classSnapshot,
      imageCount: sortedImages.length,
      annotationCount: sortedImages.reduce((total, image) => total + image.annotations.length, 0),
    }, null, 2)}\n`, "utf8");
    await writeStorageFile(path.posix.join(storagePath, "dataset.json"), metadataContent);
    byteSize += metadataContent.byteLength;

    const annotationCount = sortedImages.reduce((total, image) => total + image.annotations.length, 0);
    const dataset = await prisma.$transaction(async (transaction) => {
      const created = await transaction.datasetVersion.create({
        data: {
          id: datasetId,
          projectId,
          version,
          name: input.name,
          format: "YOLO",
          status: "READY",
          imageResizeMode: input.imageSize ? "LETTERBOX" : "ORIGINAL",
          imageSize: input.imageSize,
          trainPercent: input.trainPercent,
          validationPercent: input.validationPercent,
          testPercent: input.testPercent,
          storagePath,
          byteSize,
          imageCount: sortedImages.length,
          trainImageCount: splitCounts.train,
          validationImageCount: splitCounts.val,
          testImageCount: splitCounts.test,
          classCount: classSnapshot.length,
          annotationCount,
          classSnapshotJson: JSON.stringify(classSnapshot),
          createdAt,
          images: { create: datasetImages },
        },
        select: datasetSelect,
      });
      await transaction.project.update({ where: { id: projectId }, data: { updatedAt: createdAt, nextDatasetVersion: { increment: 1 } } });
      await transaction.activityLog.create({
        data: {
          projectId,
          type: "DATASET_CREATED",
          message: `Created Dataset v${version} “${input.name}”`,
          metadata: JSON.stringify({ datasetId, version, imageCount: sortedImages.length, annotationCount, imageSize: input.imageSize }),
        },
      });
      return created;
    });
    return serializeDataset(dataset);
  } catch (error) {
    await removeStorageDirectory(storagePath).catch(() => undefined);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new DatasetGenerationError("VERSION_CONFLICT", "มีการสร้าง Dataset เวอร์ชันอื่นพร้อมกัน กรุณาลองใหม่อีกครั้ง");
    }
    throw error;
  }
}

export async function getDatasetDownload(datasetId: string, userId: string) {
  return prisma.datasetVersion.findFirst({
    where: { id: datasetId, project: { createdById: userId }, status: "READY" },
    select: { id: true, version: true, name: true, storagePath: true },
  });
}

export async function deleteDatasetVersion(datasetId: string, userId: string) {
  const dataset = await prisma.datasetVersion.findFirst({
    where: { id: datasetId, project: { createdById: userId } },
    select: { id: true, projectId: true, version: true, name: true, storagePath: true, _count: { select: { trainingJobEntries: true } } },
  });
  if (!dataset) return null;
  if (dataset._count.trainingJobEntries > 0) return "IN_USE" as const;

  await prisma.$transaction([
    prisma.datasetVersion.delete({ where: { id: datasetId } }),
    prisma.project.update({ where: { id: dataset.projectId }, data: { updatedAt: new Date() } }),
    prisma.activityLog.create({
      data: { projectId: dataset.projectId, type: "DATASET_DELETED", message: `Deleted Dataset v${dataset.version} “${dataset.name}”` },
    }),
  ]);
  await removeStorageDirectory(dataset.storagePath).catch(() => undefined);
  return { id: dataset.id };
}

export function allocateSplitCounts(total: number, input: Pick<GenerateDatasetInput, "trainPercent" | "validationPercent" | "testPercent">) {
  const splits = [
    { key: "train" as const, percent: input.trainPercent, priority: 0 },
    { key: "val" as const, percent: input.validationPercent, priority: 1 },
    { key: "test" as const, percent: input.testPercent, priority: 2 },
  ];
  const counts = { train: 0, val: 0, test: 0 };
  const allocations = splits.map((split) => {
    const exact = total * split.percent / 100;
    const count = Math.floor(exact);
    counts[split.key] = count;
    return { ...split, remainder: exact - count };
  });
  const remaining = total - counts.train - counts.val - counts.test;
  allocations.sort((left, right) => right.remainder - left.remainder || left.priority - right.priority);
  for (let index = 0; index < remaining; index += 1) {
    const allocation = allocations[index % allocations.length];
    if (allocation) counts[allocation.key] += 1;
  }
  return counts;
}

function serializeDataset(dataset: DatasetRecord): DatasetVersionItem {
  return {
    id: dataset.id,
    version: dataset.version,
    name: dataset.name,
    format: "YOLO",
    status: dataset.status === "GENERATING" ? "GENERATING" : dataset.status === "FAILED" ? "FAILED" : "READY",
    imageResizeMode: dataset.imageResizeMode === "LETTERBOX" ? "LETTERBOX" : "ORIGINAL",
    imageSize: dataset.imageSize === 120 || dataset.imageSize === 320 || dataset.imageSize === 640 ? dataset.imageSize : null,
    trainPercent: dataset.trainPercent,
    validationPercent: dataset.validationPercent,
    testPercent: dataset.testPercent,
    byteSize: dataset.byteSize,
    imageCount: dataset.imageCount,
    trainImageCount: dataset.trainImageCount,
    validationImageCount: dataset.validationImageCount,
    testImageCount: dataset.testImageCount,
    classCount: dataset.classCount,
    annotationCount: dataset.annotationCount,
    createdAt: dataset.createdAt.toISOString(),
    trainingJobCount: dataset._count.trainingJobEntries,
  };
}

function stableImageScore(projectId: string, imageSha256: string) {
  return createHash("sha256").update(`${projectId}:${imageSha256}`).digest("hex");
}

function splitForIndex(index: number, counts: { train: number; val: number; test: number }): DatasetSplit {
  if (index < counts.train) return "train";
  if (index < counts.train + counts.val) return "val";
  return "test";
}

function databaseSplitFor(split: DatasetSplit): DatabaseSplit {
  if (split === "train") return "TRAIN";
  if (split === "val") return "VALIDATION";
  return "TEST";
}

function datasetImageFileName(filename: string, mimeType: string, imageId: string, index: number, imageSize: GenerateDatasetInput["imageSize"]) {
  const extension = imageSize ? ".jpg" : mimeType === "image/png" ? ".png" : mimeType === "image/webp" ? ".webp" : ".jpg";
  const originalBase = path.parse(filename).name.normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  const base = (originalBase || "image").slice(0, 64);
  return `${String(index + 1).padStart(6, "0")}-${base}-${imageId.slice(-6)}${extension}`;
}

function annotationToYoloLine(
  annotation: { classId: string; x: number; y: number; width: number; height: number },
  classIndex: Map<string, number>,
  transform: BoxTransform | null,
) {
  const index = classIndex.get(annotation.classId);
  if (index === undefined) throw new Error("Annotation อ้างถึง Class ที่ไม่อยู่ใน Snapshot ของ Dataset");
  const resized = transform ? transformAnnotation(annotation, transform) : annotation;
  const centerX = clamp01(resized.x + resized.width / 2);
  const centerY = clamp01(resized.y + resized.height / 2);
  return `${index} ${formatYoloValue(centerX)} ${formatYoloValue(centerY)} ${formatYoloValue(clamp01(resized.width))} ${formatYoloValue(clamp01(resized.height))}`;
}

async function prepareDatasetImage(sourcePath: string, destinationPath: string, imageSize: GenerateDatasetInput["imageSize"]) {
  if (!imageSize) {
    return { byteSize: await copyStorageFile(sourcePath, destinationPath), transform: null };
  }

  const source = await readStorageFile(sourcePath);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sharpLib: any;
  try {
    // dynamic import so build can proceed when sharp native binary isn't available
    sharpLib = (await import("sharp")).default ?? (await import("sharp"));
  } catch {
    // Fallback: copy original file without resizing
    const byteSize = await copyStorageFile(sourcePath, destinationPath);
    return { byteSize, transform: null };
  }

  const metadata = await sharpLib(source, { failOn: "error" }).metadata();
  if (!metadata.width || !metadata.height) throw new Error("ไม่สามารถอ่านขนาดของรูปต้นฉบับได้");
  const swapsAxes = metadata.orientation !== undefined && metadata.orientation >= 5 && metadata.orientation <= 8;
  const sourceWidth = swapsAxes ? metadata.height : metadata.width;
  const sourceHeight = swapsAxes ? metadata.width : metadata.height;
  const resized = await sharpLib(source, { failOn: "error" })
    .rotate()
    .resize({ width: imageSize, height: imageSize, fit: "inside", withoutEnlargement: false })
    .toColorspace("srgb")
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const offsetX = Math.floor((imageSize - resized.info.width) / 2);
  const offsetY = Math.floor((imageSize - resized.info.height) / 2);
  const right = imageSize - resized.info.width - offsetX;
  const bottom = imageSize - resized.info.height - offsetY;
  const output = await sharpLib(resized.data, { raw: resized.info })
    .extend({ top: offsetY, bottom, left: offsetX, right, background: { r: 114, g: 114, b: 114 } })
    .jpeg({ quality: 88, chromaSubsampling: "4:2:0", mozjpeg: true })
    .toBuffer();
  await writeStorageFile(destinationPath, output);
  return {
    byteSize: output.byteLength,
    transform: {
      sourceWidth,
      sourceHeight,
      resizedWidth: resized.info.width,
      resizedHeight: resized.info.height,
      offsetX,
      offsetY,
      targetSize: imageSize,
    },
  };
}

function transformAnnotation(annotation: { x: number; y: number; width: number; height: number }, transform: BoxTransform) {
  const scaleX = transform.resizedWidth / transform.sourceWidth;
  const scaleY = transform.resizedHeight / transform.sourceHeight;
  return {
    x: (transform.offsetX + annotation.x * transform.sourceWidth * scaleX) / transform.targetSize,
    y: (transform.offsetY + annotation.y * transform.sourceHeight * scaleY) / transform.targetSize,
    width: annotation.width * transform.sourceWidth * scaleX / transform.targetSize,
    height: annotation.height * transform.sourceHeight * scaleY / transform.targetSize,
  };
}

function createDataYaml(classes: Array<{ name: string; index: number }>) {
  const names = classes.map((visionClass) => `  ${visionClass.index}: ${JSON.stringify(visionClass.name)}`).join("\n");
  return `path: .\ntrain: images/train\nval: images/val\ntest: images/test\n\nnames:\n${names}\n`;
}

function formatYoloValue(value: number) {
  return value.toFixed(6);
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}
