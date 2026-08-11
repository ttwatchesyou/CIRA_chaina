import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api";
import { isWorkerRequestAuthorized } from "@/lib/worker-auth";
import { registerTrainingWorker } from "@/server/services/training.service";

export const runtime = "nodejs";

const nullableText = z.string().trim().max(250).nullable().optional();
const registrationSchema = z.object({
  workerKey: z.string().trim().min(1).max(120).regex(/^[a-zA-Z0-9._:-]+$/),
  hostname: z.string().trim().min(1).max(120),
  ipAddress: nullableText,
  cpu: nullableText,
  ramTotalMb: z.number().int().nonnegative().nullable().optional(),
  gpu: nullableText,
  gpuMemoryMb: z.number().int().nonnegative().nullable().optional(),
  os: nullableText,
  agentVersion: nullableText,
  capabilities: z.record(z.string(), z.unknown()).nullable().optional(),
});

export async function POST(request: Request) {
  if (!isWorkerRequestAuthorized(request)) return apiError("WORKER_UNAUTHORIZED", "Worker token ไม่ถูกต้อง", 401);
  const parsed = registrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_ERROR", "ข้อมูลเครื่อง Worker ไม่ถูกต้อง", 422, parsed.error.flatten().fieldErrors);
  return apiSuccess(await registerTrainingWorker(parsed.data), 201);
}

