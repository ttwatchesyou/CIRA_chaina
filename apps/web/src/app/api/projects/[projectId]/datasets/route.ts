import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import {
  DatasetGenerationError,
  generateDatasetVersion,
  getDatasetWorkspace,
} from "@/server/services/dataset.service";

export const runtime = "nodejs";

const generateDatasetSchema = z.object({
  name: z.string().trim().min(2, "Dataset name must be at least 2 characters.").max(100, "Dataset name is limited to 100 characters."),
  imageSize: z.union([z.literal(120), z.literal(320), z.literal(640)]).nullable(),
  trainPercent: z.number().int().min(1).max(100),
  validationPercent: z.number().int().min(0).max(99),
  testPercent: z.number().int().min(0).max(99),
}).superRefine((input, context) => {
  if (input.trainPercent + input.validationPercent + input.testPercent !== 100) {
    context.addIssue({ code: "custom", path: ["trainPercent"], message: "สัดส่วน Train, Validation และ Test ต้องรวมกันเป็น 100%" });
  }
});

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await currentUser();
  if (!user) return apiError("UNAUTHENTICATED", "ไม่พบสิทธิ์เข้าใช้งาน", 401);
  const { projectId } = await params;

  try {
    const workspace = await getDatasetWorkspace(projectId, user.id);
    if (!workspace) return apiError("NOT_FOUND", "ไม่พบโปรเจกต์นี้", 404);
    return apiSuccess(workspace);
  } catch {
    return apiError("DATASET_LIST_FAILED", "ไม่สามารถโหลดเวอร์ชัน Dataset ได้", 500);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const user = await currentUser();
  if (!user) return apiError("UNAUTHENTICATED", "ไม่พบสิทธิ์เข้าใช้งาน", 401);
  const { projectId } = await params;
  const parsed = generateDatasetSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_ERROR", "กรุณาตรวจการตั้งค่า Dataset", 422, parsed.error.flatten().fieldErrors);

  try {
    const dataset = await generateDatasetVersion(projectId, user.id, parsed.data);
    if (!dataset) return apiError("NOT_FOUND", "ไม่พบโปรเจกต์นี้", 404);
    return apiSuccess(dataset, 201);
  } catch (error) {
    if (error instanceof DatasetGenerationError) return apiError(error.code, error.message, error.code === "VERSION_CONFLICT" ? 409 : 422);
    return apiError("DATASET_GENERATION_FAILED", "ไม่สามารถสร้าง Dataset ได้ กรุณาตรวจว่าไฟล์รูปต้นฉบับยังอยู่ครบ", 500);
  }
}
