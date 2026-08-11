import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";

export const MOBILE_UPLOAD_LINK_TTL_MINUTES = 15;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createMobileUploadLink(projectId: string, userId: string) {
  const project = await prisma.project.findFirst({ where: { id: projectId, createdById: userId }, select: { id: true } });
  if (!project) return null;

  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + MOBILE_UPLOAD_LINK_TTL_MINUTES * 60_000);
  const token = randomBytes(32).toString("base64url");

  const link = await prisma.$transaction(async (transaction) => {
    await transaction.uploadAccessToken.updateMany({
      where: { projectId, revokedAt: null, expiresAt: { gt: createdAt } },
      data: { revokedAt: createdAt },
    });

    const createdLink = await transaction.uploadAccessToken.create({
      data: { projectId, tokenHash: hashToken(token), expiresAt },
      select: { id: true, expiresAt: true },
    });

    await transaction.activityLog.create({
      data: {
        projectId,
        type: "MOBILE_UPLOAD_LINK_CREATED",
        message: "Created a mobile upload QR link",
        metadata: JSON.stringify({ expiresAt: createdLink.expiresAt.toISOString() }),
      },
    });
    return createdLink;
  });

  return { ...link, token };
}

export async function getMobileUploadAccess(token: string) {
  const link = await prisma.uploadAccessToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      revokedAt: true,
      project: { select: { id: true, name: true, createdById: true } },
    },
  });

  if (!link || !link.project.createdById || link.revokedAt || link.expiresAt <= new Date()) return null;
  return {
    linkId: link.id,
    projectId: link.project.id,
    userId: link.project.createdById,
    projectName: link.project.name,
    expiresAt: link.expiresAt,
  };
}

export async function revokeMobileUploadLink(projectId: string, userId: string, linkId: string) {
  const result = await prisma.uploadAccessToken.updateMany({
    where: { id: linkId, projectId, revokedAt: null, project: { createdById: userId } },
    data: { revokedAt: new Date() },
  });
  return result.count > 0;
}
