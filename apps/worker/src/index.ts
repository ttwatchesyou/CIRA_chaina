import { execFile, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createWriteStream, readFileSync, rmSync } from "node:fs";
import { mkdir, open, readFile, rm } from "node:fs/promises";
import { arch, cpus, hostname, networkInterfaces, platform, release, totalmem, freemem } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const AGENT_VERSION = "0.2.0";
const DEVELOPMENT_WORKER_TOKEN = "ivp-local-worker-token";
const execFileAsync = promisify(execFile);
const configuredServerUrl = normalizeServerUrl(process.env.WORKER_SERVER_URL || process.env.APP_URL || "http://localhost:3000");
const apiToken = process.env.WORKER_API_TOKEN || DEVELOPMENT_WORKER_TOKEN;
const workerKey = process.env.WORKER_KEY || hostname().toLowerCase().replace(/[^a-z0-9._:-]+/g, "-");
const heartbeatIntervalMs = positiveInteger(process.env.WORKER_HEARTBEAT_MS, 8_000);
const pollIntervalMs = positiveInteger(process.env.WORKER_POLL_MS, 3_000);
const simulationEpochMs = positiveInteger(process.env.WORKER_SIMULATION_EPOCH_MS, 250);
const discoveryPortCount = positiveInteger(process.env.WORKER_DISCOVERY_PORT_COUNT, 10);
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const configuredCacheRoot = process.env.WORKER_DATA_DIR || "./storage/worker-cache";
const cacheRoot = path.isAbsolute(configuredCacheRoot) ? configuredCacheRoot : path.resolve(workspaceRoot, configuredCacheRoot);
const workerMode = process.env.WORKER_MODE?.toLowerCase() === "simulation" ? "simulation" : "real";
const configuredPython = process.env.WORKER_PYTHON || (platform() === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python");
const pythonExecutable = path.isAbsolute(configuredPython) ? configuredPython : path.resolve(workspaceRoot, configuredPython);
const trainerScript = path.resolve(workspaceRoot, "apps/worker/training/train.py");
const workerLockPath = path.resolve(workspaceRoot, ".runtime", `worker-${workerKey.replace(/[^a-zA-Z0-9._-]+/g, "-")}.lock.json`);

type JobStatus = "PREPARING" | "DOWNLOADING_DATASET" | "TRAINING" | "VALIDATING" | "SAVING_MODEL" | "COMPLETED" | "FAILED" | "CANCELLED";
type ClaimedJob = {
  id: string;
  outputName: string;
  epochs: number;
  imageSize: number;
  batchSize: number;
  baseModel: string;
  device: string;
};
type ClaimResponse = { data: { job: ClaimedJob; datasetDownloadUrl: string } | null };
type EventResponse = { data: { cancelRequested: boolean } };
type HeartbeatResponse = { data: { currentJob: { id: string; cancelRequested: boolean } | null } };
type TrainerEvent = {
  type: "runtime" | "dataset_ready" | "epoch" | "complete" | "cancelled" | "error";
  epoch?: number;
  epochs?: number;
  metrics?: Record<string, number>;
  best?: string;
  last?: string | null;
  results?: string | null;
  message?: string;
};

class ApiRequestError extends Error {
  constructor(public readonly route: string, public readonly status: number, message: string) {
    super(message);
    this.name = "ApiRequestError";
  }
}

let running = true;
let busy = false;
let lastError: string | null = null;
let previousCpu = cpuSnapshot();
let serverUrl = configuredServerUrl;
let reconnectPromise: Promise<void> | null = null;
let activeTraining: { jobId: string; child: ChildProcessWithoutNullStreams; cancelRequested: boolean } | null = null;
let ownsWorkerLock = false;

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.on("exit", releaseWorkerLockSync);

await acquireWorkerLock();
if (workerMode === "real") await checkRealTrainingRuntime();
await connectToServer();
console.info(`[worker] เชื่อมต่อ ${serverUrl} แล้ว (${workerKey})`);
console.info(workerMode === "real"
  ? `[worker] โหมด Real: ใช้ Ultralytics ผ่าน ${pythonExecutable}`
  : "[worker] โหมด Simulation: ไม่ได้สร้างไฟล์ PyTorch checkpoint จริง");

const heartbeatTimer = setInterval(() => void heartbeat(), heartbeatIntervalMs);
while (running) {
  if (!busy) await claimAndRun().catch((error) => {
    lastError = errorMessage(error);
    console.error(`[worker] ${lastError}`);
  });
  await delay(pollIntervalMs);
}
clearInterval(heartbeatTimer);
await releaseWorkerLock();

async function registrationPayload() {
  const gpu = await readGpu();
  return {
    workerKey,
    hostname: hostname(),
    ipAddress: primaryIpAddress(),
    cpu: cpus()[0]?.model || `${arch()} CPU`,
    ramTotalMb: bytesToMb(totalmem()),
    gpu: gpu?.name || null,
    gpuMemoryMb: gpu?.memoryTotalMb || null,
    os: `${platform()} ${release()} (${arch()})`,
    agentVersion: AGENT_VERSION,
    capabilities: { modes: [workerMode], trainingFrameworks: workerMode === "real" ? ["ultralytics"] : ["simulation"] },
  };
}

async function connectToServer() {
  const body = await registrationPayload();
  const candidates = serverCandidates();
  let lastConnectionError: unknown = null;

  for (const candidate of candidates) {
    try {
      await apiAt(candidate, "/api/workers/register", body);
      if (candidate !== serverUrl) console.info(`[worker] พบ Web API ที่ ${candidate}`);
      serverUrl = candidate;
      return;
    } catch (error) {
      lastConnectionError = error;
      if (error instanceof ApiRequestError && error.status === 401) throw error;
    }
  }

  throw new Error(`หา Web API ไม่พบ (ลอง ${candidates.join(", ")}): ${errorMessage(lastConnectionError)}`);
}

async function reconnectToServer() {
  if (!reconnectPromise) {
    reconnectPromise = connectToServer().finally(() => {
      reconnectPromise = null;
    });
  }
  return reconnectPromise;
}

async function heartbeat() {
  try {
    const gpu = await readGpu();
    const currentCpu = cpuSnapshot();
    const cpuUsage = cpuPercent(previousCpu, currentCpu);
    previousCpu = currentCpu;
    const response = await api<HeartbeatResponse>("/api/workers/heartbeat", {
      workerKey,
      status: lastError ? "ERROR" : busy ? "BUSY" : "IDLE",
      cpuUsage,
      ramUsedMb: bytesToMb(totalmem() - freemem()),
      gpuMemoryUsedMb: gpu?.memoryUsedMb || null,
      lastError,
    });
    if (activeTraining && response.data.currentJob?.id === activeTraining.jobId && response.data.currentJob.cancelRequested) {
      stopActiveTraining(activeTraining.jobId);
    }
    if (!busy) lastError = null;
  } catch (error) {
    console.error(`[worker] heartbeat ไม่สำเร็จ: ${errorMessage(error)}`);
  }
}

async function claimAndRun() {
  const payload = await api<ClaimResponse>("/api/workers/jobs/claim", { workerKey });
  if (!payload.data) return;
  busy = true;
  lastError = null;
  try {
    if (workerMode === "real") await runRealTraining(payload.data.job, payload.data.datasetDownloadUrl);
    else await runSimulation(payload.data.job, payload.data.datasetDownloadUrl);
  } catch (error) {
    lastError = errorMessage(error);
    await report(payload.data.job.id, "FAILED", { message: `Train ไม่สำเร็จ: ${lastError}`, errorMessage: lastError, level: "ERROR" }).catch(() => undefined);
  } finally {
    await cleanupJobCache(payload.data.job.id);
    busy = false;
  }
}

async function runRealTraining(job: ClaimedJob, datasetDownloadUrl: string) {
  console.info(`[worker] รับงานจริง ${job.id}: ${job.baseModel}, ${job.epochs} epochs`);
  let response = await report(job.id, "DOWNLOADING_DATASET", { message: "กำลังดาวน์โหลด Dataset จาก Server" });
  if (response.data.cancelRequested) return cancel(job.id);
  const datasetZip = await downloadDataset(job.id, datasetDownloadUrl);
  const workDirectory = jobCachePath(job.id);

  response = await report(job.id, "TRAINING", {
    currentEpoch: 0,
    progress: 0,
    message: `เริ่ม Train จริงด้วย ${job.baseModel}`,
  });
  if (response.data.cancelRequested) return cancel(job.id);

  const child = spawn(pythonExecutable, [
    trainerScript,
    "--dataset-zip", datasetZip,
    "--work-dir", workDirectory,
    "--model", job.baseModel,
    "--epochs", String(job.epochs),
    "--imgsz", String(job.imageSize),
    "--batch", String(job.batchSize),
    "--device", job.device || "auto",
  ], { cwd: workDirectory, env: { ...process.env, PYTHONUNBUFFERED: "1" } });

  activeTraining = { jobId: job.id, child, cancelRequested: false };
  const trainerState: { completeEvent: TrainerEvent | null; error: string | null; metrics: Record<string, number> } = {
    completeEvent: null,
    error: null,
    metrics: {},
  };
  let reportQueue: Promise<void> = Promise.resolve();
  const stdout = createInterface({ input: child.stdout });
  const stderr = createInterface({ input: child.stderr });

  stdout.on("line", (line) => {
    if (!line.startsWith("IVP_EVENT ")) {
      if (line.trim()) console.info(`[train] ${line}`);
      return;
    }
    const event = parseJson(line.slice("IVP_EVENT ".length)) as TrainerEvent | null;
    if (!event?.type) return;
    if (event.type === "complete") trainerState.completeEvent = event;
    if (event.type === "error") trainerState.error = event.message || "Python trainer ทำงานไม่สำเร็จ";
    if (event.type === "runtime") console.info(`[worker] Python training runtime พร้อมใช้งาน`);
    if (event.type === "dataset_ready") console.info(`[worker] แตกและตรวจ Dataset ของงาน ${job.id} แล้ว`);
    if (event.type === "epoch" && event.epoch) {
      trainerState.metrics = { ...trainerState.metrics, ...event.metrics };
      const epoch = Math.min(event.epoch, job.epochs);
      reportQueue = reportQueue.then(async () => {
        const epochResponse = await report(job.id, "TRAINING", {
          currentEpoch: epoch,
          progress: Math.min((epoch / job.epochs) * 90, 90),
          message: `Epoch ${epoch}/${job.epochs} เสร็จแล้ว`,
          metrics: event.metrics || {},
        });
        if (epochResponse.data.cancelRequested) stopActiveTraining(job.id);
      });
    }
  });
  stderr.on("line", (line) => {
    if (line.trim()) console.error(`[train] ${line}`);
  });

  const exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
  await reportQueue;
  const cancelled = activeTraining?.jobId === job.id && activeTraining.cancelRequested;
  activeTraining = null;

  if (cancelled || exit.signal === "SIGTERM" || exit.signal === "SIGKILL") return cancel(job.id);
  if (exit.code !== 0) throw new Error(trainerState.error || `Python trainer จบด้วย exit code ${exit.code}`);
  const completeEvent = trainerState.completeEvent;
  if (!completeEvent || !completeEvent.best) throw new Error("Train จบแต่ไม่ได้รับตำแหน่งไฟล์ best.pt จาก Python trainer");

  const metrics = { ...trainerState.metrics, ...completeEvent.metrics };
  response = await report(job.id, "VALIDATING", {
    currentEpoch: job.epochs,
    progress: 94,
    message: "Train และตรวจ Validation เสร็จแล้ว",
    metrics,
  });
  if (response.data.cancelRequested) return cancel(job.id);
  response = await report(job.id, "SAVING_MODEL", {
    currentEpoch: job.epochs,
    progress: 98,
    message: "กำลังส่ง best.pt และผลการ Train กลับ Server",
    metrics,
  });
  if (response.data.cancelRequested) return cancel(job.id);

  await uploadArtifact(job.id, "best", completeEvent.best, "best.pt");
  if (completeEvent.last) await uploadArtifact(job.id, "last", completeEvent.last, "last.pt");
  if (completeEvent.results) await uploadArtifact(job.id, "results", completeEvent.results, "results.csv");
  await report(job.id, "COMPLETED", {
    currentEpoch: job.epochs,
    progress: 100,
    message: "Train สำเร็จและส่งไฟล์ Model กลับ Server แล้ว",
    metrics,
  });
  console.info(`[worker] งาน ${job.id} สำเร็จ — ส่ง best.pt กลับ Server แล้ว`);
}

async function runSimulation(job: ClaimedJob, datasetDownloadUrl: string) {
  console.info(`[worker] รับงาน ${job.id}: ${job.baseModel}, ${job.epochs} epochs`);
  let response = await report(job.id, "DOWNLOADING_DATASET", { message: "กำลังดาวน์โหลด Dataset จาก Server" });
  if (response.data.cancelRequested) return cancel(job.id);
  await downloadDataset(job.id, datasetDownloadUrl);

  response = await report(job.id, "TRAINING", { currentEpoch: 0, progress: 0, message: `เริ่ม simulation ${job.baseModel}` });
  if (response.data.cancelRequested) return cancel(job.id);
  for (let epoch = 1; epoch <= job.epochs && running; epoch += 1) {
    await delay(simulationEpochMs);
    const ratio = epoch / job.epochs;
    response = await report(job.id, "TRAINING", {
      currentEpoch: epoch,
      progress: ratio * 90,
      message: `Epoch ${epoch}/${job.epochs}`,
      metrics: {
        loss: round(1.2 * (1 - ratio) + 0.08),
        boxLoss: round(0.8 * (1 - ratio) + 0.04),
        classLoss: round(0.5 * (1 - ratio) + 0.02),
        map50: round(0.15 + ratio * 0.7),
        map50_95: round(0.08 + ratio * 0.52),
      },
    });
    if (response.data.cancelRequested) return cancel(job.id);
  }
  if (!running) return cancel(job.id);

  response = await report(job.id, "VALIDATING", { currentEpoch: job.epochs, progress: 94, message: "กำลังตรวจผล Validation" });
  if (response.data.cancelRequested) return cancel(job.id);
  await delay(800);
  response = await report(job.id, "SAVING_MODEL", { currentEpoch: job.epochs, progress: 98, message: "กำลังเตรียมพื้นที่ Model artifact" });
  if (response.data.cancelRequested) return cancel(job.id);
  await delay(500);
  await report(job.id, "COMPLETED", { currentEpoch: job.epochs, progress: 100, message: "Simulation สำเร็จ — ขั้นถัดไปจะเชื่อม Ultralytics และบันทึก best.pt" });
  console.info(`[worker] งาน ${job.id} simulation สำเร็จ`);
}

async function downloadDataset(jobId: string, url: string) {
  const directory = jobCachePath(jobId);
  await mkdir(directory, { recursive: true });
  const response = await fetch(url, { headers: { Authorization: `Bearer ${apiToken}`, "X-Worker-Key": workerKey } });
  if (!response.ok || !response.body) throw new Error(`ดาวน์โหลด Dataset ไม่สำเร็จ (${response.status})`);
  const destination = path.join(directory, "dataset.zip");
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination));
  return destination;
}

async function uploadArtifact(jobId: string, kind: "best" | "last" | "results", sourcePath: string, fileName: string) {
  const content = await readFile(sourcePath);
  const send = (baseUrl: string) => fetch(`${baseUrl}/api/workers/jobs/${jobId}/artifacts/${kind}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "X-Worker-Key": workerKey,
      "X-File-Name": fileName,
      "Content-Length": String(content.length),
      "Content-Type": "application/octet-stream",
    },
    body: content,
  });
  let response = await send(serverUrl);
  if (response.status === 404 || response.status >= 500) {
    await reconnectToServer();
    response = await send(serverUrl);
  }
  if (!response.ok) {
    const payload = parseJson(await response.text()) as { error?: { message?: string } } | null;
    throw new Error(payload?.error?.message || `อัปโหลด ${fileName} ไม่สำเร็จ (${response.status})`);
  }
  console.info(`[worker] อัปโหลด ${fileName} (${formatBytes(content.length)}) แล้ว`);
}

async function cleanupJobCache(jobId: string) {
  const directory = jobCachePath(jobId);
  try {
    await rm(directory, { recursive: true, force: true });
    console.info(`[worker] ลบ Dataset cache ของงาน ${jobId} แล้ว`);
  } catch (error) {
    console.warn(`[worker] ลบ Dataset cache ไม่สำเร็จ: ${errorMessage(error)}`);
  }
}

function jobCachePath(jobId: string) {
  if (!/^[a-zA-Z0-9-]+$/.test(jobId)) throw new Error("Training job ID ไม่ถูกต้อง");
  return path.join(cacheRoot, jobId);
}

async function cancel(jobId: string) {
  await report(jobId, "CANCELLED", { message: "Worker หยุดงานตามคำขอแล้ว", level: "WARNING" });
  console.info(`[worker] ยกเลิกงาน ${jobId}`);
}

function stopActiveTraining(jobId: string) {
  if (!activeTraining || activeTraining.jobId !== jobId || activeTraining.cancelRequested) return;
  activeTraining.cancelRequested = true;
  console.info(`[worker] ได้รับคำขอยกเลิกงาน ${jobId}; กำลังหยุด Python trainer`);
  activeTraining.child.kill("SIGTERM");
  const child = activeTraining.child;
  setTimeout(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  }, 10_000).unref();
}

async function checkRealTrainingRuntime() {
  try {
    const { stdout } = await execFileAsync(pythonExecutable, [
      "-c",
      "import torch, ultralytics; print(f'PyTorch {torch.__version__}, Ultralytics {ultralytics.__version__}, CUDA {torch.cuda.is_available()}')",
    ], { cwd: workspaceRoot, timeout: 30_000 });
    console.info(`[worker] ${stdout.trim()}`);
  } catch (error) {
    throw new Error(`ยังเปิด Real Worker ไม่ได้: ${errorMessage(error)}\nรัน yarn worker:setup หนึ่งครั้งก่อน แล้วลอง yarn worker ใหม่`);
  }
}

async function acquireWorkerLock() {
  await mkdir(path.dirname(workerLockPath), { recursive: true });
  const existing = await readWorkerLock();
  if (existing && existing.pid !== process.pid && processIsRunning(existing.pid)) {
    console.error(`[worker] Worker ${workerKey} เปิดอยู่แล้ว (PID ${existing.pid})`);
    console.error("[worker] กลับไปใช้ Terminal เดิม หรือกด Ctrl + C ที่ Terminal เดิมก่อนเปิดใหม่");
    process.exit(1);
  }
  await rm(workerLockPath, { force: true });
  try {
    const lockFile = await open(workerLockPath, "wx");
    await lockFile.writeFile(JSON.stringify({ pid: process.pid, workerKey, startedAt: new Date().toISOString() }));
    await lockFile.close();
    ownsWorkerLock = true;
  } catch (error) {
    const raceWinner = await readWorkerLock();
    if (raceWinner && processIsRunning(raceWinner.pid)) {
      console.error(`[worker] Worker ${workerKey} เปิดขึ้นพร้อมกันอีก Terminal (PID ${raceWinner.pid})`);
      process.exit(1);
    }
    throw error;
  }
}

async function readWorkerLock() {
  try {
    const value = parseJson(await readFile(workerLockPath, "utf8")) as { pid?: unknown } | null;
    return typeof value?.pid === "number" ? { pid: value.pid } : null;
  } catch {
    return null;
  }
}

function processIsRunning(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function releaseWorkerLock() {
  if (!ownsWorkerLock) return;
  const lock = await readWorkerLock();
  if (lock?.pid === process.pid) await rm(workerLockPath, { force: true });
  ownsWorkerLock = false;
}

function releaseWorkerLockSync() {
  if (!ownsWorkerLock) return;
  try {
    const lock = parseJson(readFileSync(workerLockPath, "utf8")) as { pid?: unknown } | null;
    if (lock?.pid === process.pid) rmSync(workerLockPath, { force: true });
  } catch {
    // A stale or already removed lock is safe to ignore during process exit.
  }
  ownsWorkerLock = false;
}

function report(jobId: string, status: JobStatus, detail: Record<string, unknown> = {}) {
  return api<EventResponse>(`/api/workers/jobs/${jobId}/events`, { workerKey, status, ...detail });
}

async function api<T = { data: unknown }>(route: string, body: Record<string, unknown>): Promise<T> {
  try {
    return await apiAt<T>(serverUrl, route, body);
  } catch (error) {
    if (!shouldReconnect(error)) throw error;
    await reconnectToServer();
    return apiAt<T>(serverUrl, route, body);
  }
}

async function apiAt<T = { data: unknown }>(baseUrl: string, route: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${baseUrl}${route}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const responseText = await response.text();
  const payload = parseJson(responseText) as { error?: { message?: string } } | null;
  if (!response.ok) throw new ApiRequestError(route, response.status, payload?.error?.message || `${route} ตอบกลับ ${response.status}`);
  return payload as T;
}

function shouldReconnect(error: unknown) {
  if (!(error instanceof ApiRequestError)) return true;
  return error.status === 404 || error.status >= 500;
}

function serverCandidates() {
  const candidates = new Set<string>([serverUrl, configuredServerUrl]);
  const configured = new URL(configuredServerUrl);
  if (!configured.port) return [...candidates];

  const firstPort = Number(configured.port || (configured.protocol === "https:" ? 443 : 80));
  for (let offset = 0; offset <= discoveryPortCount; offset += 1) {
    const candidate = new URL(configured);
    candidate.port = String(firstPort + offset);
    candidates.add(normalizeServerUrl(candidate.toString()));
  }
  return [...candidates];
}

function normalizeServerUrl(value: string) {
  const url = new URL(value);
  url.pathname = url.pathname.replace(/\/$/, "");
  return url.toString().replace(/\/$/, "");
}

function parseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

async function readGpu() {
  try {
    const { stdout } = await execFileAsync("nvidia-smi", ["--query-gpu=name,memory.total,memory.used", "--format=csv,noheader,nounits"], { timeout: 3_000 });
    const [name, total, used] = stdout.trim().split("\n")[0]?.split(",").map((value) => value.trim()) || [];
    if (!name) return null;
    return { name, memoryTotalMb: Number(total) || null, memoryUsedMb: Number(used) || null };
  } catch {
    return null;
  }
}

function primaryIpAddress() {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses || []) if (address.family === "IPv4" && !address.internal) return address.address;
  }
  return null;
}

function cpuSnapshot() {
  return cpus().reduce((result, cpu) => {
    const total = Object.values(cpu.times).reduce((sum, value) => sum + value, 0);
    return { idle: result.idle + cpu.times.idle, total: result.total + total };
  }, { idle: 0, total: 0 });
}

function cpuPercent(previous: { idle: number; total: number }, current: { idle: number; total: number }) {
  const total = current.total - previous.total;
  const idle = current.idle - previous.idle;
  return total <= 0 ? 0 : Math.round((1 - idle / total) * 1_000) / 10;
}

function bytesToMb(value: number) {
  return Math.round(value / 1024 / 1024);
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 102.4) / 10} KB`;
  return `${Math.round(value / 1024 / 102.4) / 10} MB`;
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function round(value: number) {
  return Math.round(value * 1_000) / 1_000;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function stop() {
  running = false;
  if (activeTraining) stopActiveTraining(activeTraining.jobId);
  console.info("\n[worker] กำลังหยุด Worker...");
}
