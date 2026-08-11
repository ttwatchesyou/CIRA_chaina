import { apiError, apiSuccess } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { revokeMobileUploadLink } from "@/server/services/mobile-upload-link.service";

type RouteContext = { params: Promise<{ projectId: string; linkId: string }> };

export async function DELETE(_: Request, { params }: RouteContext) {
  const user = await currentUser();
  if (!user) return apiError("UNAUTHENTICATED", "ไม่พบสิทธิ์เข้าใช้งาน", 401);
  const { projectId, linkId } = await params;

  try {
    const revoked = await revokeMobileUploadLink(projectId, user.id, linkId);
    if (!revoked) return apiError("NOT_FOUND", "ไม่พบลิงก์อัปโหลดจากมือถือ หรือลิงก์ถูกยกเลิกแล้ว", 404);
    return apiSuccess({ id: linkId });
  } catch {
    return apiError("MOBILE_LINK_REVOKE_FAILED", "ไม่สามารถยกเลิกลิงก์อัปโหลดจากมือถือได้", 500);
  }
}
