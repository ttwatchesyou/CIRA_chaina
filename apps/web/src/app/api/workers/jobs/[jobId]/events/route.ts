import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api";
import { isWorkerRequestAuthorized } from "@/lib/worker-auth";
import { TrainingServiceError, updateTrainingJobFromWorker } from "@/server/services/training.service";

export const runtime = "nodejs";

const metricsSchema = z.object({
  loss: z.number().finite().optional(),
  boxLoss: z.number().finite().optional(),
  classLoss: z.number().finite().optional(),
  map50: z.number().finite().optional(),
  map50_95: z.number().finite().optional(),
  gpuUsage: z.number().min(0).max(100).optional(),
  gpuMemoryUsedMb: z.number().nonnegative().optional(),
  cpuUsage: z.number().min(0).max(100).optional(),
  ramUsedMb: z.number().nonnegative().optional(),
});
const eventSchema = z.object({
  workerKey: z.string().trim().min(1).max(120),
  status: z.enum(["PREPARING", "DOWNLOADING_DATASET", "TRAINING", "VALIDATING", "SAVING_MODEL", "COMPLETED", "FAILED", "CANCELLED"]),
  currentEpoch: z.number().int().nonnegative().optional(),
  progress: z.number().min(0).max(100).optional(),
  metrics: metricsSchema.optional(),
  message: z.string().trim().min(1).max(2_000).optional(),
  level: z.enum(["INFO", "WARNING", "ERROR"]).optional(),
  errorMessage: z.string().trim().max(4_000).nullable().optional(),
});

type RouteContext = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  if (!isWorkerRequestAuthorized(request)) return apiError("WORKER_UNAUTHORIZED", "Worker token ไม่ถูกต้อง", 401);
  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_ERROR", "ข้อมูลสถานะงานไม่ถูกต้อง", 422, parsed.error.flatten().fieldErrors);
  const { jobId } = await params;
  try {
    const result = await updateTrainingJobFromWorker(parsed.data.workerKey, jobId, parsed.data);
    if (!result) return apiError("NOT_FOUND", "ไม่พบ Training job", 404);
    return apiSuccess(result);
  } catch (error) {
    if (error instanceof TrainingServiceError) return apiError(error.code, error.message, 409);
    return apiError("TRAINING_UPDATE_FAILED", "บันทึกสถานะ Training ไม่สำเร็จ", 500);
  }
}

