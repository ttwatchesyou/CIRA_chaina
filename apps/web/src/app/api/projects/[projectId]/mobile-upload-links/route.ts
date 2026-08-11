import { apiError, apiSuccess } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { publicAppUrl } from "@/lib/public-app-url";
import { createMobileUploadLink } from "@/server/services/mobile-upload-link.service";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const user = await currentUser();
  if (!user) return apiError("UNAUTHENTICATED", "ไม่พบสิทธิ์เข้าใช้งาน", 401);
  const { projectId } = await params;

  try {
    const link = await createMobileUploadLink(projectId, user.id);
    if (!link) return apiError("NOT_FOUND", "ไม่พบโปรเจกต์นี้", 404);

    return apiSuccess({
      id: link.id,
      url: `${publicAppUrl(request)}/mobile-upload/${link.token}`,
      expiresAt: link.expiresAt.toISOString(),
    }, 201);
  } catch {
    return apiError("MOBILE_LINK_CREATE_FAILED", "ไม่สามารถสร้างลิงก์อัปโหลดจากมือถือได้", 500);
  }
}
