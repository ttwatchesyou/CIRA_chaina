import { Readable } from "node:stream";

import { apiError } from "@/lib/api";
import { createStorageZip } from "@/lib/storage";
import { isWorkerRequestAuthorized } from "@/lib/worker-auth";
import { ensureTrainingDatasetBundle } from "@/server/services/training-dataset.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  if (!isWorkerRequestAuthorized(request)) return apiError("WORKER_UNAUTHORIZED", "Worker token ไม่ถูกต้อง", 401);
  const workerKey = request.headers.get("x-worker-key")?.trim();
  if (!workerKey) return apiError("WORKER_KEY_REQUIRED", "ไม่พบ Worker key", 422);
  const { jobId } = await params;

  try {
    const bundle = await ensureTrainingDatasetBundle(jobId, workerKey);
    if (!bundle) return apiError("NOT_FOUND", "ไม่พบงานหรือ Worker ไม่ตรงกับงานนี้", 404);
    const archive = await createStorageZip(bundle.storagePath, "training_dataset");
    return new Response(Readable.toWeb(archive) as ReadableStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="training-dataset-${jobId}.zip"`,
        "Cache-Control": "private, no-store",
        "X-Dataset-Count": String(bundle.datasetCount),
      },
    });
  } catch (error) {
    console.error("Training dataset merge failed", error);
    return apiError("TRAINING_DATASET_MERGE_FAILED", "รวมและจัดไฟล์ Dataset ไม่สำเร็จ", 500);
  }
}
