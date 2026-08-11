import { constants, createReadStream, existsSync } from "node:fs";
import { appendFile, copyFile, mkdir, readFile, readdir, rm, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import * as yazl from "yazl";

function getWorkspaceRoot() {
  const workingDirectory = process.cwd();
  if (existsSync(path.join(workingDirectory, "prisma"))) return workingDirectory;
  return path.resolve(workingDirectory, "../..");
}

const workspaceRoot = getWorkspaceRoot();
const configuredStorageRoot = process.env.STORAGE_ROOT ?? "./storage";
const storageRoot = path.isAbsolute(configuredStorageRoot)
  ? configuredStorageRoot
  : path.resolve(workspaceRoot, configuredStorageRoot);

function resolveStoragePath(relativePath: string) {
  const absolutePath = path.resolve(storageRoot, relativePath);
  const pathFromRoot = path.relative(storageRoot, absolutePath);

  if (pathFromRoot.startsWith("..") || path.isAbsolute(pathFromRoot)) {
    throw new Error("ตำแหน่งพื้นที่เก็บข้อมูลไม่ถูกต้อง");
  }

  return absolutePath;
}

export function originalImagePath(accountId: string, projectId: string, fileName: string) {
  return path.posix.join("accounts", accountId, "projects", projectId, "original", fileName);
}

export function thumbnailImagePath(accountId: string, projectId: string, fileName: string) {
  return path.posix.join("accounts", accountId, "projects", projectId, "thumbnails", fileName);
}

export function datasetVersionPath(accountId: string, datasetVersionId: string) {
  return path.posix.join("accounts", accountId, "datasets", datasetVersionId);
}

export function trainingJobLogPath(trainingJobId: string) {
  return path.posix.join("training", trainingJobId, "logs", "training.log");
}

export function modelArtifactFilePath(projectId: string, trainingJobId: string, fileName: string) {
  return path.posix.join("models", projectId, trainingJobId, fileName);
}

export async function ensureStorageDirectory(relativePath: string) {
  await mkdir(resolveStoragePath(relativePath), { recursive: true });
}

export async function writeStorageFile(relativePath: string, content: Buffer) {
  const absolutePath = resolveStoragePath(relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, { flag: "wx" });
}

export async function replaceStorageFile(relativePath: string, content: Buffer) {
  const absolutePath = resolveStoragePath(relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content);
}

export async function appendStorageFile(relativePath: string, content: string) {
  const absolutePath = resolveStoragePath(relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await appendFile(absolutePath, content, "utf8");
}

export async function readStorageFile(relativePath: string) {
  return readFile(resolveStoragePath(relativePath));
}

export function createStorageReadStream(relativePath: string) {
  return createReadStream(resolveStoragePath(relativePath));
}

export async function storageFileStat(relativePath: string) {
  return stat(resolveStoragePath(relativePath));
}

export async function storagePathExists(relativePath: string) {
  try {
    await stat(resolveStoragePath(relativePath));
    return true;
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return false;
    throw error;
  }
}

export async function listStorageFiles(relativePath: string) {
  const rootPath = resolveStoragePath(relativePath);
  const entries = await walkStorageDirectory(rootPath);
  return entries.filter((entry) => !entry.isDirectory).map((entry) => entry.relativePath.split(path.sep).join(path.posix.sep));
}

export async function copyStorageFile(sourceRelativePath: string, destinationRelativePath: string) {
  const sourcePath = resolveStoragePath(sourceRelativePath);
  const destinationPath = resolveStoragePath(destinationRelativePath);
  await mkdir(path.dirname(destinationPath), { recursive: true });
  await copyFile(sourcePath, destinationPath, constants.COPYFILE_EXCL);
  return (await stat(destinationPath)).size;
}

export async function removeStorageFile(relativePath: string) {
  try {
    await unlink(resolveStoragePath(relativePath));
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return;
    throw error;
  }
}

export async function removeStorageDirectory(relativePath: string) {
  await rm(resolveStoragePath(relativePath), { recursive: true, force: true });
}

export async function createStorageZip(relativePath: string, archiveRootName: string): Promise<Readable> {
  const directoryPath = resolveStoragePath(relativePath);
  const directoryStat = await stat(directoryPath);
  if (!directoryStat.isDirectory()) throw new Error("Dataset storage directory is missing.");

  const entries = await walkStorageDirectory(directoryPath);
  const archive = new yazl.ZipFile();
  archive.addEmptyDirectory(archiveRootName);
  for (const entry of entries) {
    const archivePath = path.posix.join(archiveRootName, entry.relativePath.split(path.sep).join(path.posix.sep));
    if (entry.isDirectory) archive.addEmptyDirectory(archivePath);
    else archive.addFile(entry.absolutePath, archivePath);
  }
  archive.end();
  return archive.outputStream as Readable;
}

export async function createStorageZipFromEntries(
  files: Array<{ storagePath: string; archivePath: string }>,
  generatedFiles: Array<{ content: Buffer; archivePath: string }> = [],
): Promise<Readable> {
  const archive = new yazl.ZipFile();
  for (const file of files) {
    const absolutePath = resolveStoragePath(file.storagePath);
    const fileStat = await stat(absolutePath);
    if (!fileStat.isFile()) throw new Error("Model artifact file is missing.");
    archive.addFile(absolutePath, safeArchivePath(file.archivePath));
  }
  for (const file of generatedFiles) archive.addBuffer(file.content, safeArchivePath(file.archivePath));
  archive.end();
  return archive.outputStream as Readable;
}

export async function removeProjectStorage(projectId: string, accountId: string | null) {
  const paths = [resolveStoragePath(path.posix.join("projects", projectId))];
  if (accountId) paths.push(resolveStoragePath(path.posix.join("accounts", accountId, "projects", projectId)));
  await Promise.all(paths.map((projectPath) => rm(projectPath, { recursive: true, force: true })));
}

function isNodeError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function safeArchivePath(value: string) {
  const normalized = path.posix.normalize(value.replaceAll("\\", "/")).replace(/^\/+/, "");
  if (!normalized || normalized === "." || normalized === ".." || normalized.startsWith("../")) {
    throw new Error("ตำแหน่งไฟล์ใน ZIP ไม่ถูกต้อง");
  }
  return normalized;
}

async function walkStorageDirectory(rootPath: string) {
  const results: Array<{ absolutePath: string; relativePath: string; isDirectory: boolean }> = [];

  async function walk(currentPath: string) {
    const entries = await readdir(currentPath, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolutePath = path.join(currentPath, entry.name);
      const relativePath = path.relative(rootPath, absolutePath);
      if (entry.isDirectory()) {
        results.push({ absolutePath, relativePath, isDirectory: true });
        await walk(absolutePath);
      } else if (entry.isFile()) {
        results.push({ absolutePath, relativePath, isDirectory: false });
      }
    }
  }

  await walk(rootPath);
  return results;
}
