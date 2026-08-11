import { apiError, apiSuccess } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { getTrainingJob } from "@/server/services/training.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await currentUser();
  if (!user) return apiError("UNAUTHENTICATED", "ไม่พบสิทธิ์เข้าใช้งาน", 401);
  const { jobId } = await params;
  const job = await getTrainingJob(jobId, user.id);
  if (!job) return apiError("NOT_FOUND", "ไม่พบ Training job", 404);
  return apiSuccess(job);
}

