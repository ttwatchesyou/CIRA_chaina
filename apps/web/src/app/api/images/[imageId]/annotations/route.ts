import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { getImageAnnotations, replaceImageAnnotations } from "@/server/services/annotation.service";

const normalizedValue = z.number().finite().min(0).max(1);
const annotationSchema = z.object({
  classId: z.string().min(1).max(64),
  x: normalizedValue,
  y: normalizedValue,
  width: normalizedValue.gt(0),
  height: normalizedValue.gt(0),
}).superRefine((box, context) => {
  if (box.x + box.width > 1.000001) context.addIssue({ code: "custom", path: ["width"], message: "กรอบเกินความกว้างของรูป" });
  if (box.y + box.height > 1.000001) context.addIssue({ code: "custom", path: ["height"], message: "กรอบเกินความสูงของรูป" });
});
const saveSchema = z.object({ annotations: z.array(annotationSchema).max(2000) });

type RouteContext = { params: Promise<{ imageId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await currentUser();
  if (!user) return apiError("UNAUTHENTICATED", "ไม่พบสิทธิ์เข้าใช้งาน", 401);
  const { imageId } = await params;

  try {
    const annotations = await getImageAnnotations(imageId, user.id);
    if (!annotations) return apiError("NOT_FOUND", "ไม่พบรูปนี้", 404);
    return apiSuccess(annotations);
  } catch {
    return apiError("ANNOTATION_LIST_FAILED", "ไม่สามารถโหลด Annotation ได้", 500);
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  const user = await currentUser();
  if (!user) return apiError("UNAUTHENTICATED", "ไม่พบสิทธิ์เข้าใช้งาน", 401);
  const { imageId } = await params;
  const parsed = saveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_ERROR", "ข้อมูล Annotation ไม่ถูกต้อง", 422, parsed.error.flatten().fieldErrors);

  try {
    const result = await replaceImageAnnotations(imageId, user.id, parsed.data.annotations);
    if (!result) return apiError("NOT_FOUND", "ไม่พบรูปนี้", 404);
    if (result === "INVALID_CLASS") return apiError("INVALID_CLASS", "มี Class อย่างน้อยหนึ่งรายการที่ไม่ได้อยู่ในโปรเจกต์นี้", 422);
    return apiSuccess(result);
  } catch {
    return apiError("ANNOTATION_SAVE_FAILED", "ไม่สามารถบันทึก Annotation ได้", 500);
  }
}
