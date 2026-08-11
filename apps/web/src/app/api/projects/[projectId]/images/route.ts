import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { MAX_FILES_PER_UPLOAD } from "@/lib/image-validation";
import { listProjectImages, uploadProjectImages } from "@/server/services/image.service";

export const runtime = "nodejs";

const imageListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24),
  query: z.string().trim().max(100).optional().transform((value) => value || undefined),
  status: z.enum(["ANNOTATED", "UNANNOTATED"]).optional(),
  sort: z.enum(["newest", "oldest", "name"]).default("newest"),
});

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const user = await currentUser();
  if (!user) return apiError("UNAUTHENTICATED", "ไม่พบสิทธิ์เข้าใช้งาน", 401);
  const { projectId } = await params;
  const parsed = imageListQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return apiError("VALIDATION_ERROR", "ตัวกรองคลังรูปภาพไม่ถูกต้อง", 422, parsed.error.flatten().fieldErrors);

  try {
    const images = await listProjectImages(projectId, user.id, parsed.data);
    if (!images) return apiError("NOT_FOUND", "ไม่พบโปรเจกต์นี้", 404);
    return apiSuccess(images);
  } catch {
    return apiError("IMAGE_LIST_FAILED", "ไม่สามารถโหลดรูปในโปรเจกต์ได้", 500);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const user = await currentUser();
  if (!user) return apiError("UNAUTHENTICATED", "ไม่พบสิทธิ์เข้าใช้งาน", 401);
  const { projectId } = await params;

  try {
    const formData = await request.formData();
    const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);

    if (files.length === 0) return apiError("NO_FILES", "เลือกรูปอย่างน้อย 1 รูปเพื่ออัปโหลด", 422);
    if (files.length > MAX_FILES_PER_UPLOAD) {
      return apiError("TOO_MANY_FILES", `อัปโหลดได้ครั้งละไม่เกิน ${MAX_FILES_PER_UPLOAD} รูป`, 422);
    }

    const result = await uploadProjectImages(projectId, user.id, files);
    if (!result) return apiError("NOT_FOUND", "ไม่พบโปรเจกต์นี้", 404);
    return apiSuccess(result, result.failed === result.items.length ? 422 : 201);
  } catch {
    return apiError("IMAGE_UPLOAD_FAILED", "ไม่สามารถประมวลผลรูปที่อัปโหลดได้", 500);
  }
}
