import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { TRAINING_MODEL_IDS } from "@/lib/training-models";
import { createTrainingJob, getTrainingWorkspace, TrainingServiceError } from "@/server/services/training.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createJobSchema = z.object({
  datasetVersionIds: z.array(z.string().trim().min(1)).min(1, "เลือก Dataset อย่างน้อย 1 รายการ").max(20),
  workerId: z.string().trim().min(1),
  outputName: z.string().trim().min(1, "กรุณาตั้งชื่อผลลัพธ์").max(80).regex(/^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u, "ใช้ได้เฉพาะตัวอักษร ตัวเลข เว้นวรรค จุด ขีดกลาง และขีดล่าง"),
  baseModel: z.enum(TRAINING_MODEL_IDS),
  epochs: z.number().int().min(1).max(10_000),
  imageSize: z.number().int().min(32).max(4_096).refine((value) => value % 32 === 0, "Image size ต้องหารด้วย 32 ลงตัว"),
  batchSize: z.number().int().min(1).max(1_024),
  device: z.string().trim().min(1).max(30).regex(/^(auto|cpu|mps|\d+(,\d+)*)$/),
}).superRefine((input, context) => {
  if (new Set(input.datasetVersionIds).size !== input.datasetVersionIds.length) {
    context.addIssue({ code: "custom", path: ["datasetVersionIds"], message: "Dataset ที่เลือกต้องไม่ซ้ำกัน" });
  }
});

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await currentUser();
  if (!user) return apiError("UNAUTHENTICATED", "ไม่พบสิทธิ์เข้าใช้งาน", 401);
  const { projectId } = await params;
  const workspace = await getTrainingWorkspace(projectId, user.id);
  if (!workspace) return apiError("NOT_FOUND", "ไม่พบโปรเจกต์นี้", 404);
  return apiSuccess(workspace);
}

export async function POST(request: Request, { params }: RouteContext) {
  const user = await currentUser();
  if (!user) return apiError("UNAUTHENTICATED", "ไม่พบสิทธิ์เข้าใช้งาน", 401);
  const parsed = createJobSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_ERROR", "กรุณาตรวจการตั้งค่า Train", 422, parsed.error.flatten().fieldErrors);
  const { projectId } = await params;
  try {
    const job = await createTrainingJob(projectId, user.id, parsed.data);
    return apiSuccess(job, 201);
  } catch (error) {
    if (error instanceof TrainingServiceError) return apiError(error.code, error.message, 409);
    return apiError("TRAINING_JOB_CREATE_FAILED", "สร้าง Training job ไม่สำเร็จ", 500);
  }
}
