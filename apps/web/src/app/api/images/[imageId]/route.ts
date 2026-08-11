import { apiError, apiSuccess } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { deleteImage } from "@/server/services/image.service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ imageId: string }> };

export async function DELETE(_: Request, { params }: RouteContext) {
  const user = await currentUser();
  if (!user) return apiError("UNAUTHENTICATED", "ไม่พบสิทธิ์เข้าใช้งาน", 401);
  const { imageId } = await params;

  try {
    const image = await deleteImage(imageId, user.id);
    if (!image) return apiError("NOT_FOUND", "ไม่พบรูปนี้", 404);
    return apiSuccess({ id: image.id });
  } catch {
    return apiError("IMAGE_DELETE_FAILED", "ไม่สามารถลบรูปได้", 500);
  }
}
