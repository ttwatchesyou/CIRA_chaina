import { ZodError } from "zod";

import { apiError, apiSuccess } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { createProjectSchema } from "@/lib/validators/project";
import { createProject, listProjects } from "@/server/services/project.service";

export async function GET() {
  const user = await currentUser();
  if (!user) return apiError("UNAUTHENTICATED", "ไม่พบสิทธิ์เข้าใช้งาน", 401);
  try {
    return apiSuccess(await listProjects(user.id));
  } catch {
    return apiError("PROJECT_LIST_FAILED", "ไม่สามารถโหลดรายการโปรเจกต์ได้", 500);
  }
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return apiError("UNAUTHENTICATED", "ไม่พบสิทธิ์เข้าใช้งาน", 401);
  try {
    const input = createProjectSchema.parse(await request.json());
    const project = await createProject(input, user.id);
    return apiSuccess({ id: project.id, name: project.name }, 201);
  } catch (error) {
    if (error instanceof ZodError) {
      return apiError("VALIDATION_ERROR", "กรุณาตรวจและแก้ไขช่องที่ระบุ", 422, error.flatten().fieldErrors);
    }

    return apiError("PROJECT_CREATE_FAILED", "ไม่สามารถสร้างโปรเจกต์ได้", 500);
  }
}
