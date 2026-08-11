import { apiError, apiSuccess } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { listTrainingWorkers } from "@/server/services/training.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return apiError("UNAUTHENTICATED", "ไม่พบสิทธิ์เข้าใช้งาน", 401);
  return apiSuccess(await listTrainingWorkers());
}

