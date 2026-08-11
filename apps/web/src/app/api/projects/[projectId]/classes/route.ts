import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { createVisionClass, isUniqueConstraintError } from "@/server/services/annotation.service";

const classSchema = z.object({
  name: z.string().trim().min(1, "กรุณาใส่ชื่อ Class").max(50, "ชื่อ Class ต้องไม่เกิน 50 ตัวอักษร"),
});

type RouteContext = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const user = await currentUser();
  if (!user) return apiError("UNAUTHENTICATED", "ไม่พบสิทธิ์เข้าใช้งาน", 401);
  const { projectId } = await params;

  const parsed = classSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_ERROR", "ชื่อ Class ไม่ถูกต้อง", 422, parsed.error.flatten().fieldErrors);

  try {
    const visionClass = await createVisionClass(projectId, user.id, parsed.data.name);
    if (!visionClass) return apiError("NOT_FOUND", "ไม่พบโปรเจกต์นี้", 404);
    return apiSuccess(visionClass, 201);
  } catch (error) {
    if (isUniqueConstraintError(error)) return apiError("DUPLICATE_CLASS", "มี Class ชื่อนี้อยู่แล้ว", 409);
    return apiError("CLASS_CREATE_FAILED", "ไม่สามารถสร้าง Class ได้", 500);
  }
}
