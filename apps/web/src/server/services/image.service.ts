import { createHash, randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

// `sharp` is a native module; load it lazily inside functions to avoid build-time failures on Linux builders

import { getDetectedImageMimeType, MAX_IMAGE_SIZE_BYTES, safeImageFilename } from "@/lib/image-validation";
import { originalImagePath, removeStorageFile, thumbnailImagePath, writeStorageFile } from "@/lib/storage";
import { extractImageFilesFromZip } from "@/lib/zip-extraction";
import { prisma } from "@/lib/prisma";
import type { ImageLibraryItem, ImageLibraryPage, UploadImagesResult, UploadItemResult } from "@/types/image";

const imageSelect = {
  id: true,
  filename: true,
  mimeType: true,
  byteSize: true,
  status: true,
  uploadedAt: true,
} as const;

type ImageRecord = Prisma.ImageGetPayload<{ select: typeof imageSelect }>;

export type ImageListOptions = {
  page: number;
  pageSize: number;
  query?: string;
  status?: "ANNOTATED" | "UNANNOTATED";
  sort: "newest" | "oldest" | "name";
};

function serializeImage(image: ImageRecord): ImageLibraryItem {
  return {
    id: image.id,
    filename: image.filename,
    mimeType: image.mimeType,
    byteSize: image.byteSize,
    status: image.status === "ANNOTATED" ? "ANNOTATED" : "UNANNOTATED",
    uploadedAt: image.uploadedAt.toISOString(),
    fileUrl: `/api/images/${image.id}/file?variant=thumbnail`,
  };
}

function orderByFor(sort: ImageListOptions["sort"]): Prisma.ImageOrderByWithRelationInput {
  if (sort === "oldest") return { uploadedAt: "asc" };
  if (sort === "name") return { filename: "asc" };
  return { uploadedAt: "desc" };
}

export async function listProjectImages(projectId: string, userId: string, options: ImageListOptions): Promise<ImageLibraryPage | null> {
  const project = await prisma.project.findFirst({ where: { id: projectId, createdById: userId }, select: { id: true } });
  if (!project) return null;

  const where: Prisma.ImageWhereInput = {
    projectId,
    ...(options.status ? { status: options.status } : {}),
    ...(options.query ? { filename: { contains: options.query } } : {}),
  };
  const [images, total] = await prisma.$transaction([
    prisma.image.findMany({
      where,
      select: imageSelect,
      orderBy: orderByFor(options.sort),
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
    }),
    prisma.image.count({ where }),
  ]);

  return {
    images: images.map(serializeImage),
    page: options.page,
    pageSize: options.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / options.pageSize)),
  };
}

export async function uploadProjectImages(projectId: string, userId: string, files: File[]): Promise<UploadImagesResult | null> {
  const project = await prisma.project.findFirst({ where: { id: projectId, createdById: userId }, select: { id: true } });
  if (!project) return null;

  const results: UploadItemResult[] = [];

  for (const file of files) {
    results.push(...await uploadFile(projectId, userId, file));
  }

  const completed = results.filter((result) => result.status === "COMPLETE").length;
  const duplicates = results.filter((result) => result.status === "DUPLICATE").length;
  const failed = results.filter((result) => result.status === "FAILED").length;

  if (completed > 0) {
    await prisma.$transaction([
      prisma.project.update({ where: { id: projectId }, data: { updatedAt: new Date() } }),
      prisma.activityLog.create({
        data: {
          projectId,
          type: "IMAGES_UPLOADED",
          message: `Uploaded ${completed} image${completed === 1 ? "" : "s"}`,
          metadata: JSON.stringify({ completed, duplicates, failed }),
        },
      }),
    ]);
  }

  return { items: results, completed, duplicates, failed };
}

async function uploadFile(projectId: string, userId: string, file: File): Promise<UploadItemResult[]> {
  if (!file.name.toLowerCase().endsWith(".zip")) return [await uploadOneImage(projectId, userId, file)];

  try {
    const extractedImages = await extractImageFilesFromZip(file);
    const results: UploadItemResult[] = [];
    for (const extractedImage of extractedImages) {
      results.push(await uploadOneImage(projectId, userId, extractedImage));
    }
    return results;
  } catch (error) {
    return [{
      filename: file.name || "archive.zip",
      status: "FAILED",
      message: error instanceof Error ? error.message : "ไม่สามารถแตกไฟล์ ZIP ได้",
    }];
  }
}

async function uploadOneImage(projectId: string, userId: string, file: File): Promise<UploadItemResult> {
  const fallbackName = file.name || "image";

  if (file.size === 0) {
    return { filename: fallbackName, status: "FAILED", message: "ไฟล์ว่างเปล่า" };
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return { filename: fallbackName, status: "FAILED", message: "รูปต้องมีขนาดไม่เกิน 25 MB" };
  }

  const content = Buffer.from(await file.arrayBuffer());
  const mimeType = getDetectedImageMimeType(content);
  if (!mimeType) {
    return { filename: fallbackName, status: "FAILED", message: "รองรับเฉพาะรูป JPG, PNG และ WebP ที่เปิดได้ตามปกติ" };
  }

  const sha256 = createHash("sha256").update(content).digest("hex");
  const duplicate = await prisma.image.findUnique({
    where: { projectId_sha256: { projectId, sha256 } },
    select: imageSelect,
  });
  if (duplicate) {
    return { filename: fallbackName, status: "DUPLICATE", image: serializeImage(duplicate), message: "รูปนี้มีอยู่ในโปรเจกต์แล้ว" };
  }

  const filename = safeImageFilename(fallbackName, mimeType);
  const storedFilename = `${randomUUID()}-${filename}`;
  const storedPath = originalImagePath(userId, projectId, storedFilename);
  const storedThumbnailPath = thumbnailImagePath(userId, projectId, `${randomUUID()}.jpg`);

  let imageMetadata: any;
  let thumbnail: Buffer;
  try {
    const sharpLib = (await import("sharp")).default ?? (await import("sharp"));
    imageMetadata = await sharpLib(content, { failOn: "error" }).metadata();
    thumbnail = await sharpLib(content, { failOn: "error" })
      .rotate()
      .resize(480, 480, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
  } catch {
    try {
      const Jimp = (await import("jimp")).default ?? (await import("jimp"));
      const j = await Jimp.read(content as any);
      imageMetadata = { width: j.bitmap.width, height: j.bitmap.height };
      const resized = j.contain(480, 480, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE).quality(82);
      thumbnail = await resized.getBufferAsync(Jimp.MIME_JPEG);
    } catch {
      return { filename: fallbackName, status: "FAILED", message: "ไม่สามารถประมวลผลข้อมูลรูปได้" };
    }
  }

  try {
    await writeStorageFile(storedPath, content);
    await writeStorageFile(storedThumbnailPath, thumbnail);
  } catch {
    await removeStorageFile(storedPath);
    await removeStorageFile(storedThumbnailPath);
    return { filename: fallbackName, status: "FAILED", message: "ไม่สามารถเขียนรูปลงพื้นที่เก็บข้อมูลของ Server ได้" };
  }

  try {
    const image = await prisma.image.create({
      data: {
        projectId,
        filename,
        originalPath: storedPath,
        thumbnailPath: storedThumbnailPath,
        mimeType,
        byteSize: content.byteLength,
        sha256,
        width: imageMetadata.width,
        height: imageMetadata.height,
      },
      select: imageSelect,
    });
    return { filename, status: "COMPLETE", image: serializeImage(image) };
  } catch (error) {
    await Promise.all([removeStorageFile(storedPath), removeStorageFile(storedThumbnailPath)]);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.image.findUnique({
        where: { projectId_sha256: { projectId, sha256 } },
        select: imageSelect,
      });
      return {
        filename: fallbackName,
        status: "DUPLICATE",
        ...(existing ? { image: serializeImage(existing) } : {}),
        message: "รูปนี้มีอยู่ในโปรเจกต์แล้ว",
      };
    }
    return { filename: fallbackName, status: "FAILED", message: "ไม่สามารถบันทึกข้อมูลรูปได้" };
  }
}

export async function findImageFile(id: string, userId: string) {
  return prisma.image.findFirst({
    where: { id, project: { createdById: userId } },
    select: { originalPath: true, thumbnailPath: true, mimeType: true, filename: true },
  });
}

export async function deleteImage(id: string, userId: string) {
  const image = await prisma.image.findFirst({ where: { id, project: { createdById: userId } } });
  if (!image) return null;

  await prisma.$transaction([
    prisma.datasetImage.deleteMany({ where: { imageId: id } }),
    prisma.image.delete({ where: { id } }),
    prisma.project.update({ where: { id: image.projectId }, data: { updatedAt: new Date() } }),
    prisma.activityLog.create({
      data: {
        projectId: image.projectId,
        type: "IMAGE_DELETED",
        message: `Deleted image “${image.filename}”`,
      },
    }),
  ]);
  await Promise.all([
    removeStorageFile(image.originalPath),
    ...(image.thumbnailPath ? [removeStorageFile(image.thumbnailPath)] : []),
  ]);
  return image;
}
