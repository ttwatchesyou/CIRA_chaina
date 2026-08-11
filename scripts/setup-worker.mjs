import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const virtualEnvironment = path.join(workspaceRoot, ".venv");
const virtualPython = process.platform === "win32"
  ? path.join(virtualEnvironment, "Scripts", "python.exe")
  : path.join(virtualEnvironment, "bin", "python");
const systemPython = process.env.WORKER_SETUP_PYTHON || "python3";
const requirements = path.join(workspaceRoot, "apps", "worker", "training", "requirements.txt");

console.info("[setup] กำลังเตรียม Python environment สำหรับเทรนจริง");
if (!(await exists(virtualPython))) {
  await run(systemPython, ["-m", "venv", virtualEnvironment], "สร้าง .venv ไม่สำเร็จ กรุณาติดตั้ง python3-venv ก่อน");
}

await run(virtualPython, ["-m", "pip", "install", "--upgrade", "pip", "setuptools", "wheel"]);

const hasNvidia = await commandSucceeds("nvidia-smi", ["-L"]);
const torchIndexUrl = process.env.WORKER_TORCH_INDEX_URL || (hasNvidia ? "" : "https://download.pytorch.org/whl/cpu");
const torchArguments = ["-m", "pip", "install", "--upgrade", "torch", "torchvision"];
if (torchIndexUrl) torchArguments.push("--index-url", torchIndexUrl);

console.info(hasNvidia
  ? "[setup] พบ NVIDIA GPU — กำลังติดตั้ง PyTorch (กำหนด WORKER_TORCH_INDEX_URL ได้หากต้องการ CUDA รุ่นเฉพาะ)"
  : "[setup] ไม่พบ NVIDIA GPU — จะติดตั้ง PyTorch รุ่น CPU");
await run(virtualPython, torchArguments);
await run(virtualPython, ["-m", "pip", "install", "--upgrade", "-r", requirements]);
await run(virtualPython, [
  "-c",
  "import sys, torch, ultralytics; print(f'[setup] Python {sys.version.split()[0]} | PyTorch {torch.__version__} | Ultralytics {ultralytics.__version__} | CUDA {torch.cuda.is_available()}')",
]);

console.info("[setup] พร้อมเทรนจริงแล้ว เปิด Web ด้วย yarn dev และเปิด Worker ด้วย yarn worker");

async function run(command, args, failureMessage) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: workspaceRoot, stdio: "inherit", env: process.env });
    child.once("error", (error) => reject(new Error(failureMessage || `${command}: ${error.message}`)));
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(failureMessage || `${command} จบด้วย ${signal || `exit code ${code}`}`));
    });
  });
}

async function commandSucceeds(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: workspaceRoot, stdio: "ignore" });
    child.once("error", () => resolve(false));
    child.once("exit", (code) => resolve(code === 0));
  });
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}
