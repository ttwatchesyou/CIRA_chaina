import { Readable } from "node:stream";

import * as yauzl from "yauzl";

import { MAX_IMAGE_SIZE_BYTES, MAX_ZIP_UPLOAD_BYTES } from "@/lib/image-validation";

const MAX_IMAGES_PER_ZIP = 500;
const MAX_ZIP_UNCOMPRESSED_BYTES = 500 * 1024 * 1024;
const imageEntryPattern = /\.(jpe?g|png|webp)$/i;

export async function extractImageFilesFromZip(file: File): Promise<File[]> {
  if (file.size === 0) throw new Error("ไฟล์ ZIP ว่างเปล่า");
  if (file.size > MAX_ZIP_UPLOAD_BYTES) throw new Error("ไฟล์ ZIP ต้องมีขนาดไม่เกิน 250 MB");

  const zip = await yauzl.fromBufferPromise(Buffer.from(await file.arrayBuffer()), {
    lazyEntries: true,
    validateEntrySizes: true,
    strictFileNames: true,
  });
  const images: File[] = [];
  let totalUncompressedBytes = 0;

  try {
    for await (const entry of zip.eachEntry()) {
      if (entry.fileName.endsWith("/") || !imageEntryPattern.test(entry.fileName)) continue;
      if (entry.uncompressedSize > MAX_IMAGE_SIZE_BYTES) {
        throw new Error(`“${entry.fileName}” มีขนาดเกิน 25 MB`);
      }
      if (images.length >= MAX_IMAGES_PER_ZIP) {
        throw new Error(`ไฟล์ ZIP ใส่รูปได้สูงสุด ${MAX_IMAGES_PER_ZIP} รูป`);
      }

      totalUncompressedBytes += entry.uncompressedSize;
      if (totalUncompressedBytes > MAX_ZIP_UNCOMPRESSED_BYTES) {
        throw new Error("ไฟล์ ZIP เมื่อแตกแล้วมีขนาดเกินขีดจำกัด 500 MB");
      }

      const stream = await zip.openReadStreamPromise(entry);
      const content = await streamToBuffer(stream, entry.uncompressedSize);
      images.push(new File([content], entry.fileName.split("/").pop() || "image"));
    }
  } finally {
    zip.close();
  }

  if (images.length === 0) throw new Error("ไม่พบรูป JPG, PNG หรือ WebP ในไฟล์ ZIP นี้");
  return images;
}

async function streamToBuffer(stream: Readable, expectedSize: number) {
  const parts: Buffer[] = [];
  let totalSize = 0;

  for await (const part of stream) {
    const buffer = Buffer.isBuffer(part) ? part : Buffer.from(part);
    totalSize += buffer.length;
    if (totalSize > expectedSize || totalSize > MAX_IMAGE_SIZE_BYTES) {
      stream.destroy();
      throw new Error("รูปที่แตกออกจาก ZIP มีขนาดเกินกำหนด");
    }
    parts.push(buffer);
  }

  return Buffer.concat(parts);
}
