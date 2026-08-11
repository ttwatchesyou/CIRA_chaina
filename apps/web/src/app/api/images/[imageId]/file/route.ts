import { apiError } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { readStorageFile } from "@/lib/storage";
import { findImageFile } from "@/server/services/image.service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ imageId: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const user = await currentUser();
  if (!user) return apiError("UNAUTHENTICATED", "ไม่พบสิทธิ์เข้าใช้งาน", 401);
  const { imageId } = await params;
  const image = await findImageFile(imageId, user.id);
  if (!image) return apiError("NOT_FOUND", "ไม่พบรูปนี้", 404);
  const wantsThumbnail = new URL(request.url).searchParams.get("variant") === "thumbnail";
  const storagePath = wantsThumbnail && image.thumbnailPath ? image.thumbnailPath : image.originalPath;
  const mimeType = wantsThumbnail && image.thumbnailPath ? "image/jpeg" : image.mimeType;

  try {
    const content = await readStorageFile(storagePath);
    return new Response(content, {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": content.byteLength.toString(),
        "Content-Disposition": `inline; filename="${encodeURIComponent(image.filename)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return apiError("FILE_NOT_FOUND", "ไม่พบไฟล์รูปในพื้นที่เก็บข้อมูล", 404);
  }
}
