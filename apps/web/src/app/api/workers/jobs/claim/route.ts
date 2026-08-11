import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api";
import { requestAppUrl } from "@/lib/public-app-url";
import { isWorkerRequestAuthorized } from "@/lib/worker-auth";
import { claimTrainingJob } from "@/server/services/training.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const claimSchema = z.object({ workerKey: z.string().trim().min(1).max(120) });

export async function POST(request: Request) {
  if (!isWorkerRequestAuthorized(request)) return apiError("WORKER_UNAUTHORIZED", "Worker token ไม่ถูกต้อง", 401);
  const parsed = claimSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_ERROR", "ข้อมูล Worker ไม่ถูกต้อง", 422, parsed.error.flatten().fieldErrors);
  const job = await claimTrainingJob(parsed.data.workerKey);
  if (!job) return apiSuccess(null);

  const baseUrl = requestAppUrl(request, process.env.WORKER_PUBLIC_APP_URL);
  return apiSuccess({ job, datasetDownloadUrl: `${baseUrl}/api/workers/jobs/${job.id}/dataset` });
}
