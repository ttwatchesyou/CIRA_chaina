import { apiError, apiSuccess } from "@/lib/api";
import { isWorkerRequestAuthorized } from "@/lib/worker-auth";
import { ModelServiceError, saveModelArtifactFromWorker } from "@/server/services/model.service";
import type { ModelFileKind } from "@/types/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ARTIFACT_BYTES = 512 * 1024 * 1024;
type RouteContext = { params: Promise<{ jobId: string; kind: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  if (!isWorkerRequestAuthorized(request)) return apiError("WORKER_UNAUTHORIZED", "Worker token ไม่ถูกต้อง", 401);
  const workerKey = request.headers.get("x-worker-key")?.trim();
  if (!workerKey) return apiError("WORKER_KEY_REQUIRED", "ไม่พบ Worker key", 422);
  const fileName = request.headers.get("x-file-name")?.trim();
  if (!fileName) return apiError("FILE_NAME_REQUIRED", "ไม่พบชื่อไฟล์ Model", 422);
  const declaredSize = Number(request.headers.get("content-length") || 0);
  if (declaredSize > MAX_ARTIFACT_BYTES) return apiError("FILE_TOO_LARGE", "ไฟล์ Model ต้องไม่เกิน 512 MB", 413);

  const { jobId, kind } = await params;
  if (!isModelFileKind(kind)) return apiError("INVALID_ARTIFACT_KIND", "ชนิดไฟล์ Model ไม่ถูกต้อง", 422);
  const content = Buffer.from(await request.arrayBuffer());
  if (content.length > MAX_ARTIFACT_BYTES) return apiError("FILE_TOO_LARGE", "ไฟล์ Model ต้องไม่เกิน 512 MB", 413);

  try {
    const model = await saveModelArtifactFromWorker({
      workerKey,
      trainingJobId: jobId,
      kind,
      fileName,
      modelName: request.headers.get("x-model-name"),
      content,
    });
    if (!model) return apiError("NOT_FOUND", "ไม่พบ Training job", 404);
    return apiSuccess({ id: model.id, kind }, 201);
  } catch (error) {
    if (error instanceof ModelServiceError) {
      const status = error.code === "WORKER_MISMATCH" ? 403 : error.code === "INVALID_ARTIFACT" ? 422 : 409;
      return apiError(error.code, error.message, status);
    }
    console.error("Model artifact upload failed", error);
    return apiError("MODEL_UPLOAD_FAILED", "บันทึกไฟล์ Model ไม่สำเร็จ", 500);
  }
}

function isModelFileKind(value: string): value is ModelFileKind {
  return value === "best" || value === "last" || value === "results";
}
