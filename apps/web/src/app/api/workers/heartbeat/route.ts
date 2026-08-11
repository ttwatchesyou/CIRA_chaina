import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api";
import { isWorkerRequestAuthorized } from "@/lib/worker-auth";
import { heartbeatTrainingWorker } from "@/server/services/training.service";

export const runtime = "nodejs";

const heartbeatSchema = z.object({
  workerKey: z.string().trim().min(1).max(120),
  status: z.enum(["IDLE", "BUSY", "ERROR"]).optional(),
  cpuUsage: z.number().min(0).max(100).nullable().optional(),
  ramUsedMb: z.number().int().nonnegative().nullable().optional(),
  gpuMemoryUsedMb: z.number().int().nonnegative().nullable().optional(),
  lastError: z.string().trim().max(2_000).nullable().optional(),
});

export async function POST(request: Request) {
  if (!isWorkerRequestAuthorized(request)) return apiError("WORKER_UNAUTHORIZED", "Worker token ไม่ถูกต้อง", 401);
  const parsed = heartbeatSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_ERROR", "ข้อมูล Heartbeat ไม่ถูกต้อง", 422, parsed.error.flatten().fieldErrors);
  const result = await heartbeatTrainingWorker(parsed.data);
  if (!result) return apiError("WORKER_NOT_REGISTERED", "ยังไม่ได้ Register เครื่อง Worker", 404);
  return apiSuccess(result);
}

