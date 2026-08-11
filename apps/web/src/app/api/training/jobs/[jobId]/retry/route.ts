import { apiError, apiSuccess } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { retryTrainingJob, TrainingServiceError } from "@/server/services/training.service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const user = await currentUser();
  if (!user) return apiError("UNAUTHENTICATED", "ไม่พบสิทธิ์เข้าใช้งาน", 401);
  const { jobId } = await params;
  try {
    const job = await retryTrainingJob(jobId, user.id);
    if (!job) return apiError("NOT_FOUND", "ไม่พบ Training job", 404);
    return apiSuccess(job, 201);
  } catch (error) {
    if (error instanceof TrainingServiceError) return apiError(error.code, error.message, 409);
    return apiError("TRAINING_RETRY_FAILED", "สร้างงาน Retry ไม่สำเร็จ", 500);
  }
}

