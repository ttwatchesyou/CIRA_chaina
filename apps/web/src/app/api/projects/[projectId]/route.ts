import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

import { apiError, apiSuccess } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { deleteProject, getProjectOverview } from "@/server/services/project.service";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(_: Request, { params }: RouteContext) {
  const user = await currentUser();
  if (!user) return apiError("UNAUTHENTICATED", "ไม่พบสิทธิ์เข้าใช้งาน", 401);
  const { projectId } = await params;

  try {
    const project = await getProjectOverview(projectId, user.id);
    if (!project) return apiError("NOT_FOUND", "ไม่พบโปรเจกต์นี้", 404);
    return apiSuccess(project);
  } catch {
    return apiError("PROJECT_READ_FAILED", "ไม่สามารถโหลดโปรเจกต์ได้", 500);
  }
}

export async function DELETE(_: Request, { params }: RouteContext) {
  const user = await currentUser();
  if (!user) return apiError("UNAUTHENTICATED", "ไม่พบสิทธิ์เข้าใช้งาน", 401);
  const { projectId } = await params;

  try {
    const project = await deleteProject(projectId, user.id);
    if (!project) return apiError("NOT_FOUND", "ไม่พบโปรเจกต์นี้", 404);
    return apiSuccess({ id: projectId });
  } catch (error) {
  if (error instanceof PrismaClientKnownRequestError && error.code === "P2025") {
    return apiError("NOT_FOUND", "ไม่พบโปรเจกต์นี้", 404);
  }
}
}
