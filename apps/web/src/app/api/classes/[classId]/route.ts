import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import {
  deleteVisionClass,
  isUniqueConstraintError,
  renameVisionClass,
} from "@/server/services/annotation.service";

const classSchema = z.object({
  name: z.string().trim().min(1, "กรุณาใส่ชื่อ Class").max(50, "ชื่อ Class ต้องไม่เกิน 50 ตัวอักษร"),
});

type RouteContext = { params: Promise<{ classId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await currentUser();
  if (!user) return apiError("UNAUTHENTICATED", "ไม่พบสิทธิ์เข้าใช้งาน", 401);
  const { classId } = await params;
  const parsed = classSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_ERROR", "ชื่อ Class ไม่ถูกต้อง", 422, parsed.error.flatten().fieldErrors);

  try {
    const visionClass = await renameVisionClass(classId, user.id, parsed.data.name);
    if (!visionClass) return apiError("NOT_FOUND", "ไม่พบ Class นี้", 404);
    return apiSuccess(visionClass);
  } catch (error) {
    if (isUniqueConstraintError(error)) return apiError("DUPLICATE_CLASS", "มี Class ชื่อนี้อยู่แล้ว", 409);
    return apiError("CLASS_UPDATE_FAILED", "ไม่สามารถเปลี่ยนชื่อ Class ได้", 500);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const user = await currentUser();
  if (!user) return apiError("UNAUTHENTICATED", "ไม่พบสิทธิ์เข้าใช้งาน", 401);
  const { classId } = await params;
  const force = new URL(request.url).searchParams.get("force") === "true";

  try {
    const result = await deleteVisionClass(classId, user.id, force);
    if (!result) return apiError("NOT_FOUND", "ไม่พบ Class นี้", 404);
    if (!result.deleted) {
      return apiError(
        "CLASS_IN_USE",
        `Class นี้ถูกใช้ใน Annotation ${result.annotationCount} รายการ`,
        409,
      );
    }
    return apiSuccess(result);
  } catch {
    return apiError("CLASS_DELETE_FAILED", "ไม่สามารถลบ Class ได้", 500);
  }
}
