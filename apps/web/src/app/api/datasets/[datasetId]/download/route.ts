import { Readable } from "node:stream";

import { apiError } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { createStorageZip } from "@/lib/storage";
import { getDatasetDownload } from "@/server/services/dataset.service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ datasetId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await currentUser();
  if (!user) return apiError("UNAUTHENTICATED", "ไม่พบสิทธิ์เข้าใช้งาน", 401);
  const { datasetId } = await params;
  const dataset = await getDatasetDownload(datasetId, user.id);
  if (!dataset) return apiError("NOT_FOUND", "ไม่พบ Dataset เวอร์ชันนี้", 404);

  try {
    const archiveRoot = `dataset_v${dataset.version}`;
    const archive = await createStorageZip(dataset.storagePath, archiveRoot);
    const filename = `${archiveRoot}-${safeDownloadName(dataset.name)}.zip`;
    return new Response(Readable.toWeb(archive) as ReadableStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return apiError("DATASET_ARCHIVE_FAILED", "ไม่สามารถสร้างไฟล์ ZIP ของ Dataset ได้", 500);
  }
}

function safeDownloadName(name: string) {
  const safe = name.normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return safe || "dataset";
}
