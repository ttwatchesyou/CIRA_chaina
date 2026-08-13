import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const projectSummarySelect = {
  id: true,
  name: true,
  description: true,
  type: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      images: true,
      classes: true,
      datasets: true,
      models: true,
      jobs: true,
    },
  },
} as const;

export type ProjectSummaryRecord = {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  createdAt: string;
  updatedAt: string;
  _count: {
    images: number;
    classes: number;
    datasets: number;
    models: number;
    jobs: number;
  };
};

export async function findProjectSummaries(userId: string) {
  return prisma.project.findMany({
    where: { createdById: userId },
    select: projectSummarySelect,
    orderBy: { updatedAt: "desc" },
  });
}

export async function findProjectSummaryById(id: string, userId: string) {
  return prisma.project.findFirst({
    where: { id, createdById: userId },
    select: projectSummarySelect,
  });
}

export async function countAnnotatedImages(projectId: string) {
  return prisma.image.count({
    where: { projectId, status: "ANNOTATED" },
  });
}

export async function findProjectActivities(projectId: string) {
  return prisma.activityLog.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { id: true, type: true, message: true, createdAt: true },
  });
}
