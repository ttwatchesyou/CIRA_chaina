import { apiError, apiSuccess } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { deleteDatasetVersion } from "@/server/services/dataset.service";

type RouteContext = { params: Promise<{ datasetId: string }> };

export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await currentUser();
  if (!user) return apiError("UNAUTHENTICATED", "ไม่พบสิทธิ์เข้าใช้งาน", 401);
  const { datasetId } = await params;

  try {
    const result = await deleteDatasetVersion(datasetId, user.id);
    if (!result) return apiError("NOT_FOUND", "ไม่พบ Dataset เวอร์ชันนี้", 404);
    if (result === "IN_USE") return apiError("DATASET_IN_USE", "Dataset นี้ถูกใช้ในงาน Train จึงยังลบไม่ได้", 409);
    return apiSuccess(result);
  } catch {
    return apiError("DATASET_DELETE_FAILED", "ไม่สามารถลบ Dataset เวอร์ชันนี้ได้", 500);
  }
}
