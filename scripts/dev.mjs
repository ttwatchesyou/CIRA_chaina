import { spawn } from "node:child_process";
import { open, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeDirectory = path.join(projectRoot, ".runtime");
const lockPath = path.join(runtimeDirectory, "web-dev.lock.json");

await mkdir(runtimeDirectory, { recursive: true });

const existingProcess = await readLock();
if (existingProcess && processIsRunning(existingProcess.pid)) {
  console.error(`[dev] เว็บของโปรเจกต์กำลังรันอยู่แล้ว (PID ${existingProcess.pid})`);
  console.error("[dev] กลับไปใช้ Terminal เดิม หรือกด Ctrl + C ที่ Terminal เดิมก่อนเปิดใหม่");
  process.exit(1);
}

await rm(lockPath, { force: true });
const lockFile = await open(lockPath, "wx");
await lockFile.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
await lockFile.close();

const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
const webProcess = spawn(process.execPath, [nextBin, "dev"], {
  cwd: path.join(projectRoot, "apps", "web"),
  env: process.env,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    if (webProcess.exitCode === null) webProcess.kill(signal);
  });
}

const exitCode = await new Promise((resolve) => {
  webProcess.once("exit", (code) => resolve(code ?? 0));
  webProcess.once("error", (error) => {
    console.error(`[dev] เปิด Next.js ไม่สำเร็จ: ${error.message}`);
    resolve(1);
  });
});

await rm(lockPath, { force: true });
process.exitCode = exitCode;

async function readLock() {
  try {
    const value = JSON.parse(await readFile(lockPath, "utf8"));
    return typeof value?.pid === "number" ? value : null;
  } catch {
    return null;
  }
}

function processIsRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
