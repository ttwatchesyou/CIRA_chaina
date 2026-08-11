import { apiError, apiSuccess } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { getAnnotationWorkspace } from "@/server/services/annotation.service";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await currentUser();
  if (!user) return apiError("UNAUTHENTICATED", "ไม่พบสิทธิ์เข้าใช้งาน", 401);
  const { projectId } = await params;

  try {
    const workspace = await getAnnotationWorkspace(projectId, user.id);
    if (!workspace) return apiError("NOT_FOUND", "ไม่พบโปรเจกต์นี้", 404);
    return apiSuccess(workspace);
  } catch {
    return apiError("ANNOTATION_WORKSPACE_FAILED", "ไม่สามารถโหลดพื้นที่ทำ Annotation ได้", 500);
  }
}
