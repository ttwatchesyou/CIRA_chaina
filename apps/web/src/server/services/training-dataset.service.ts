import path from "node:path";

import { prisma } from "@/lib/prisma";
import {
  copyStorageFile,
  ensureStorageDirectory,
  listStorageFiles,
  readStorageFile,
  removeStorageDirectory,
  storagePathExists,
  writeStorageFile,
} from "@/lib/storage";

type SnapshotClass = { index: number; name: string; color?: string };
type SourceDataset = {
  id: string;
  version: number;
  name: string;
  storagePath: string;
  classSnapshotJson: string;
  images: Array<{ imageId: string; split: string; labelPath: string }>;
};

export async function ensureTrainingDatasetBundle(trainingJobId: string, workerKey: string) {
  const job = await prisma.trainingJob.findFirst({
    where: { id: trainingJobId, worker: { workerKey } },
    select: {
      id: true,
      datasetBundlePath: true,
      datasetVersion: { select: { id: true, version: true, name: true, storagePath: true, classSnapshotJson: true, images: { select: { imageId: true, split: true, labelPath: true } } } },
      datasetEntries: {
        orderBy: { sortOrder: "asc" },
        select: { datasetVersion: { select: { id: true, version: true, name: true, storagePath: true, classSnapshotJson: true, images: { select: { imageId: true, split: true, labelPath: true } } } } },
      },
    },
  });
  if (!job) return null;

  const existingPath = job.datasetBundlePath;
  if (existingPath && await storagePathExists(path.posix.join(existingPath, "data.yaml"))) {
    return { storagePath: existingPath, datasetCount: Math.max(job.datasetEntries.length, 1) };
  }

  const sources = job.datasetEntries.length > 0
    ? job.datasetEntries.map((entry) => entry.datasetVersion)
    : [job.datasetVersion];
  const bundlePath = path.posix.join("training", job.id, "dataset-bundle");
  await removeStorageDirectory(bundlePath);

  try {
    const classPlan = createMergedClassPlan(sources);
    const counts = { train: 0, val: 0, test: 0 };
    const seenImageIds = new Set<string>();
    let duplicatesSkipped = 0;
    for (const split of ["train", "val", "test"] as const) {
      await ensureStorageDirectory(path.posix.join(bundlePath, "images", split));
      await ensureStorageDirectory(path.posix.join(bundlePath, "labels", split));
    }

    for (const [datasetIndex, dataset] of sources.entries()) {
      const localClassMap = classPlan.localToGlobal.get(dataset.id);
      if (!localClassMap) throw new Error(`ไม่พบ Class mapping ของ Dataset v${dataset.version}`);
      const prefix = `${String(datasetIndex + 1).padStart(2, "0")}-${dataset.id.slice(0, 8)}-`;
      const imageIdByLabelStem = new Map(dataset.images.map((entry) => [path.posix.parse(path.posix.basename(entry.labelPath)).name, entry.imageId]));

      for (const split of ["train", "val", "test"] as const) {
        const imageDirectory = path.posix.join(dataset.storagePath, "images", split);
        const imageFiles = await listStorageFiles(imageDirectory).catch(() => []);
        for (const imageFile of imageFiles) {
          const sourceImagePath = path.posix.join(imageDirectory, imageFile);
          const sourceBaseName = path.posix.basename(imageFile);
          const sourceStem = path.posix.parse(sourceBaseName).name;
          const sourceImageId = imageIdByLabelStem.get(sourceStem);
          if (sourceImageId && seenImageIds.has(sourceImageId)) {
            duplicatesSkipped += 1;
            continue;
          }
          if (sourceImageId) seenImageIds.add(sourceImageId);
          const destinationImageName = `${prefix}${sourceBaseName}`;
          const destinationImagePath = path.posix.join(bundlePath, "images", split, destinationImageName);
          await copyStorageFile(sourceImagePath, destinationImagePath);

          const sourceLabelName = `${path.posix.parse(sourceBaseName).name}.txt`;
          const sourceLabelPath = path.posix.join(dataset.storagePath, "labels", split, sourceLabelName);
          const destinationLabelName = `${path.posix.parse(destinationImageName).name}.txt`;
          const destinationLabelPath = path.posix.join(bundlePath, "labels", split, destinationLabelName);
          const sourceLabel = await readStorageFile(sourceLabelPath);
          const remappedLabel = remapYoloLabel(sourceLabel.toString("utf8"), localClassMap, dataset);
          await writeStorageFile(destinationLabelPath, Buffer.from(remappedLabel, "utf8"));
          counts[split] += 1;
        }
      }
    }

    await writeStorageFile(path.posix.join(bundlePath, "data.yaml"), Buffer.from(createDataYaml(classPlan.classes), "utf8"));
    await writeStorageFile(path.posix.join(bundlePath, "training-dataset.json"), Buffer.from(`${JSON.stringify({
      trainingJobId: job.id,
      generatedAt: new Date().toISOString(),
      sources: sources.map((dataset) => ({ id: dataset.id, version: dataset.version, name: dataset.name })),
      classes: classPlan.classes.map((name, index) => ({ index, name })),
      counts,
      duplicatesSkipped,
      mergePolicy: {
        classes: "merge case-insensitively by trimmed class name",
        files: "prefix with source order and Dataset ID to prevent collisions",
        duplicates: "keep the first selected occurrence of each source Image ID",
        splits: "preserve each source Dataset train/val/test split",
      },
    }, null, 2)}\n`, "utf8"));
    await prisma.trainingJob.update({ where: { id: job.id }, data: { datasetBundlePath: bundlePath } });
    return { storagePath: bundlePath, datasetCount: sources.length, counts, classes: classPlan.classes, duplicatesSkipped };
  } catch (error) {
    await removeStorageDirectory(bundlePath).catch(() => undefined);
    throw error;
  }
}

export async function removeTrainingDatasetBundle(trainingJobId: string) {
  const job = await prisma.trainingJob.findUnique({ where: { id: trainingJobId }, select: { datasetBundlePath: true } });
  if (!job?.datasetBundlePath) return;
  await removeStorageDirectory(job.datasetBundlePath).catch(() => undefined);
  await prisma.trainingJob.updateMany({ where: { id: trainingJobId, datasetBundlePath: job.datasetBundlePath }, data: { datasetBundlePath: null } });
}

function createMergedClassPlan(datasets: SourceDataset[]) {
  const classes: string[] = [];
  const globalIndexByName = new Map<string, number>();
  const localToGlobal = new Map<string, Map<number, number>>();

  for (const dataset of datasets) {
    const snapshot = parseClassSnapshot(dataset);
    const mapping = new Map<number, number>();
    for (const visionClass of snapshot) {
      const normalizedName = visionClass.name.trim().toLocaleLowerCase();
      if (!normalizedName) throw new Error(`Dataset v${dataset.version} มีชื่อ Class ว่าง`);
      let globalIndex = globalIndexByName.get(normalizedName);
      if (globalIndex === undefined) {
        globalIndex = classes.length;
        globalIndexByName.set(normalizedName, globalIndex);
        classes.push(visionClass.name.trim());
      }
      mapping.set(visionClass.index, globalIndex);
    }
    localToGlobal.set(dataset.id, mapping);
  }
  return { classes, localToGlobal };
}

function parseClassSnapshot(dataset: SourceDataset) {
  try {
    const snapshot = JSON.parse(dataset.classSnapshotJson) as SnapshotClass[];
    if (!Array.isArray(snapshot) || snapshot.length === 0) throw new Error("empty snapshot");
    return snapshot;
  } catch {
    throw new Error(`อ่าน Class snapshot ของ Dataset v${dataset.version} ไม่สำเร็จ`);
  }
}

function remapYoloLabel(content: string, classMap: Map<number, number>, dataset: SourceDataset) {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const remapped = lines.map((line) => {
    const parts = line.split(/\s+/);
    const localIndex = Number(parts[0]);
    const globalIndex = classMap.get(localIndex);
    if (!Number.isInteger(localIndex) || globalIndex === undefined || parts.length !== 5) {
      throw new Error(`YOLO label ใน Dataset v${dataset.version} ไม่ถูกต้อง`);
    }
    return `${globalIndex} ${parts.slice(1).join(" ")}`;
  });
  return remapped.length > 0 ? `${remapped.join("\n")}\n` : "";
}

function createDataYaml(classes: string[]) {
  const names = classes.map((name, index) => `  ${index}: ${JSON.stringify(name)}`).join("\n");
  return `path: .\ntrain: images/train\nval: images/val\ntest: images/test\nnc: ${classes.length}\nnames:\n${names}\n`;
}
