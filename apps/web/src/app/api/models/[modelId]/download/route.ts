import { Readable } from "node:stream";

import { apiError } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { getModelArchive, getModelDownload } from "@/server/services/model.service";
import type { ModelFileKind } from "@/types/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ modelId: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const user = await currentUser();
  if (!user) return apiError("UNAUTHENTICATED", "ไม่พบสิทธิ์เข้าใช้งาน", 401);
  const requestedFile = new URL(request.url).searchParams.get("file");
  const { modelId } = await params;
  if (!requestedFile) {
    const archive = await getModelArchive(modelId, user.id);
    if (!archive) return apiError("NOT_FOUND", "ไม่พบไฟล์ Model หรือไม่มีสิทธิ์ดาวน์โหลด", 404);
    return new Response(Readable.toWeb(archive.stream) as ReadableStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": contentDisposition(archive.fileName),
        "Cache-Control": "private, no-store",
      },
    });
  }
  const kind = requestedFile;
  if (!isModelFileKind(kind)) return apiError("INVALID_FILE_KIND", "ชนิดไฟล์ Model ไม่ถูกต้อง", 422);
  const download = await getModelDownload(modelId, user.id, kind);
  if (!download) return apiError("NOT_FOUND", "ไม่พบไฟล์ Model หรือไม่มีสิทธิ์ดาวน์โหลด", 404);

  return new Response(Readable.toWeb(download.stream) as ReadableStream, {
    headers: {
      "Content-Type": download.contentType,
      "Content-Length": String(download.size),
      "Content-Disposition": `attachment; filename="${download.fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function contentDisposition(fileName: string) {
  const asciiName = fileName.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "model.zip";
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function isModelFileKind(value: string): value is ModelFileKind {
  return value === "best" || value === "last" || value === "results";
}
