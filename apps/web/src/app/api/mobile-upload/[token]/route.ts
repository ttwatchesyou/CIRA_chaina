import { apiError, apiSuccess } from "@/lib/api";
import { MAX_FILES_PER_UPLOAD, MAX_IMAGE_SIZE_BYTES } from "@/lib/image-validation";
import { getMobileUploadAccess } from "@/server/services/mobile-upload-link.service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_: Request, { params }: RouteContext) {
  const { token } = await params;
  const access = await getMobileUploadAccess(token);
  if (!access) return apiError("LINK_INVALID", "ลิงก์อัปโหลดจากมือถือไม่ถูกต้อง หมดอายุ หรือถูกยกเลิกแล้ว", 404);

  return apiSuccess({
    projectName: access.projectName,
    expiresAt: access.expiresAt.toISOString(),
    maxFiles: MAX_FILES_PER_UPLOAD,
    maxImageSizeBytes: MAX_IMAGE_SIZE_BYTES,
  });
}
