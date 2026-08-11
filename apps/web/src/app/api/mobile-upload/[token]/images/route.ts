import { apiError, apiSuccess } from "@/lib/api";
import { MAX_FILES_PER_UPLOAD } from "@/lib/image-validation";
import { uploadProjectImages } from "@/server/services/image.service";
import { getMobileUploadAccess } from "@/server/services/mobile-upload-link.service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const { token } = await params;
  const access = await getMobileUploadAccess(token);
  if (!access) return apiError("LINK_INVALID", "ลิงก์อัปโหลดจากมือถือไม่ถูกต้อง หมดอายุ หรือถูกยกเลิกแล้ว", 404);

  try {
    const formData = await request.formData();
    const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);
    if (files.length === 0) return apiError("NO_FILES", "เลือกรูปอย่างน้อย 1 รูปเพื่ออัปโหลด", 422);
    if (files.length > MAX_FILES_PER_UPLOAD) return apiError("TOO_MANY_FILES", `อัปโหลดได้ครั้งละไม่เกิน ${MAX_FILES_PER_UPLOAD} รูป`, 422);

    const result = await uploadProjectImages(access.projectId, access.userId, files);
    if (!result) return apiError("PROJECT_NOT_FOUND", "โปรเจกต์นี้ไม่พร้อมใช้งานแล้ว", 404);
    return apiSuccess(result, result.failed === result.items.length ? 422 : 201);
  } catch {
    return apiError("MOBILE_UPLOAD_FAILED", "ไม่สามารถประมวลผลรูปที่อัปโหลดได้", 500);
  }
}
