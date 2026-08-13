import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type {
  AnnotationBox,
  AnnotationClassItem,
  AnnotationSaveResult,
  AnnotationWorkspaceData,
} from "@/types/annotation";

const CLASS_COLORS = [
  "#597A96",
  "#C86464",
  "#5B8C6A",
  "#D0A04A",
  "#8B6FA8",
  "#3F8C91",
  "#B56E8A",
  "#7A8060",
];

export async function getAnnotationWorkspace(projectId: string, userId: string): Promise<AnnotationWorkspaceData | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, createdById: userId },
    select: {
      id: true,
      name: true,
      images: {
        orderBy: [{ uploadedAt: "asc" }, { filename: "asc" }],
        select: {
          id: true,
          filename: true,
          width: true,
          height: true,
          status: true,
          uploadedAt: true,
          _count: { select: { annotations: true } },
        },
      },
      classes: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          color: true,
          _count: { select: { annotations: true } },
        },
      },
    },
  }) as {
    id: string;
    name: string;
    images: Array<{
      id: string;
      filename: string;
      width?: number | null;
      height?: number | null;
      status: string;
      uploadedAt: Date;
      _count: { annotations: number };
    }>;
    classes: Array<{ id: string; name: string; color: string; _count: { annotations: number } }>;
  } | null;
  if (!project) return null;

  return {
    projectId: project.id,
    projectName: project.name,
    images: project.images.map((image) => ({
      id: image.id,
      filename: image.filename,
      width: image.width ?? 1,
      height: image.height ?? 1,
      status: image.status === "ANNOTATED" ? "ANNOTATED" : "UNANNOTATED",
      annotationCount: image._count.annotations,
      uploadedAt: image.uploadedAt.toISOString(),
      thumbnailUrl: `/api/images/${image.id}/file?variant=thumbnail`,
      fileUrl: `/api/images/${image.id}/file`,
    })),
    classes: project.classes.map((visionClass) => serializeClass(visionClass)),
  };
}

export async function getImageAnnotations(imageId: string, userId: string): Promise<AnnotationBox[] | null> {
  const image = await prisma.image.findFirst({
    where: { id: imageId, project: { createdById: userId } },
    select: {
      annotations: {
        orderBy: { createdAt: "asc" },
        select: { id: true, classId: true, x: true, y: true, width: true, height: true },
      },
    },
  });
  return image?.annotations ?? null;
}

export async function replaceImageAnnotations(
  imageId: string,
  userId: string,
  boxes: Omit<AnnotationBox, "id">[],
): Promise<AnnotationSaveResult | null | "INVALID_CLASS"> {
  const image = await prisma.image.findFirst({
    where: { id: imageId, project: { createdById: userId } },
    select: { id: true, projectId: true, status: true },
  });
  if (!image) return null;

  const classIds = [...new Set(boxes.map((box) => box.classId))];
  if (classIds.length > 0) {
    const validClassCount = await prisma.visionClass.count({
      where: { id: { in: classIds }, projectId: image.projectId },
    });
    if (validClassCount !== classIds.length) return "INVALID_CLASS";
  }

  const status = boxes.length > 0 ? "ANNOTATED" : "UNANNOTATED";
  await prisma.$transaction(async (transaction: Prisma.TransactionClient) => {
    await transaction.annotation.deleteMany({ where: { imageId } });
    if (boxes.length > 0) {
      await transaction.annotation.createMany({
        data: boxes.map((box) => ({ imageId, ...box })),
      });
    }
    await transaction.image.update({ where: { id: imageId }, data: { status } });
    await transaction.project.update({ where: { id: image.projectId }, data: { updatedAt: new Date() } });
    if (image.status !== "ANNOTATED" && status === "ANNOTATED") {
      await transaction.activityLog.create({
        data: {
          projectId: image.projectId,
          type: "IMAGE_ANNOTATED",
          message: "Annotated an image",
          metadata: JSON.stringify({ imageId, annotationCount: boxes.length }),
        },
      });
    }
  });

  const groupedCounts = await prisma.annotation.groupBy({
    by: ["classId"],
    where: { image: { projectId: image.projectId } },
    _count: { _all: true },
  });
  return {
    status,
    annotationCount: boxes.length,
    classCounts: Object.fromEntries(groupedCounts.map((entry) => [entry.classId, entry._count._all])),
    savedAt: new Date().toISOString(),
  };
}

export async function createVisionClass(projectId: string, userId: string, name: string): Promise<AnnotationClassItem | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, createdById: userId },
    select: { id: true, _count: { select: { classes: true } } },
  });
  if (!project) return null;

  const visionClass = await prisma.$transaction(async (transaction: Prisma.TransactionClient) => {
    const created = await transaction.visionClass.create({
      data: {
        projectId,
        name,
        color: CLASS_COLORS[project._count.classes % CLASS_COLORS.length] ?? "#597A96",
      },
      select: { id: true, name: true, color: true, _count: { select: { annotations: true } } },
    });
    await transaction.project.update({ where: { id: projectId }, data: { updatedAt: new Date() } });
    await transaction.activityLog.create({
      data: { projectId, type: "CLASS_CREATED", message: `Created class “${name}”` },
    });
    return created;
  });
  return { id: visionClass.id, name: visionClass.name, color: visionClass.color, annotationCount: 0 };
}

export async function renameVisionClass(classId: string, userId: string, name: string): Promise<AnnotationClassItem | null> {
  const existing = await prisma.visionClass.findFirst({
    where: { id: classId, project: { createdById: userId } },
    select: { id: true, projectId: true },
  });
  if (!existing) return null;

  const visionClass = await prisma.$transaction(async (transaction: Prisma.TransactionClient) => {
    const updated = await transaction.visionClass.update({
      where: { id: classId },
      data: { name },
      select: { id: true, name: true, color: true, _count: { select: { annotations: true } } },
    });
    await transaction.project.update({ where: { id: existing.projectId }, data: { updatedAt: new Date() } });
    return updated;
  });
  return serializeClass(visionClass);
}

export type DeleteVisionClassResult = {
  deleted: true;
  removedAnnotations: number;
  affectedImageIds: string[];
} | {
  deleted: false;
  annotationCount: number;
};

export async function deleteVisionClass(
  classId: string,
  userId: string,
  force: boolean,
): Promise<DeleteVisionClassResult | null> {
  const visionClass = await prisma.visionClass.findFirst({
    where: { id: classId, project: { createdById: userId } },
    select: {
      id: true,
      projectId: true,
      name: true,
      _count: { select: { annotations: true } },
      annotations: { distinct: ["imageId"], select: { imageId: true } },
    },
  });
  if (!visionClass) return null;
  if (visionClass._count.annotations > 0 && !force) {
    return { deleted: false, annotationCount: visionClass._count.annotations };
  }

  const affectedImageIds = visionClass.annotations.map((annotation) => annotation.imageId);
  await prisma.$transaction(async (transaction: Prisma.TransactionClient) => {
    await transaction.annotation.deleteMany({ where: { classId } });
    await transaction.visionClass.delete({ where: { id: classId } });
    for (const imageId of affectedImageIds) {
      const remaining = await transaction.annotation.count({ where: { imageId } });
      await transaction.image.update({
        where: { id: imageId },
        data: { status: remaining > 0 ? "ANNOTATED" : "UNANNOTATED" },
      });
    }
    await transaction.project.update({ where: { id: visionClass.projectId }, data: { updatedAt: new Date() } });
    await transaction.activityLog.create({
      data: {
        projectId: visionClass.projectId,
        type: "CLASS_DELETED",
        message: `Deleted class “${visionClass.name}”`,
        metadata: JSON.stringify({ removedAnnotations: visionClass._count.annotations }),
      },
    });
  });

  return {
    deleted: true,
    removedAnnotations: visionClass._count.annotations,
    affectedImageIds,
  };
}

function serializeClass(visionClass: {
  id: string;
  name: string;
  color: string;
  _count: { annotations: number };
}): AnnotationClassItem {
  return {
    id: visionClass.id,
    name: visionClass.name,
    color: visionClass.color,
    annotationCount: visionClass._count.annotations,
  };
}

export function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
