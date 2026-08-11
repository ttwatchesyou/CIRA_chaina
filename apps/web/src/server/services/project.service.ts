import type { Project } from "@prisma/client";

import type { CreateProjectInput } from "@/lib/validators/project";
import type { ProjectOverview, ProjectSummary } from "@/types/project";

import {
  countAnnotatedImages,
  findProjectActivities,
  findProjectSummaries,
  findProjectSummaryById,
  type ProjectSummaryRecord,
} from "@/server/repositories/project.repository";
import { prisma } from "@/lib/prisma";
import { removeProjectStorage, removeStorageDirectory } from "@/lib/storage";

function serializeProject(record: ProjectSummaryRecord, annotatedImages: number): ProjectSummary {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    type: "OBJECT_DETECTION",
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    counts: {
      images: record._count.images,
      annotatedImages,
      classes: record._count.classes,
      datasets: record._count.datasets,
      models: record._count.models,
      jobs: record._count.jobs,
    },
  };
}

export async function listProjects(userId: string): Promise<ProjectSummary[]> {
  const projects = await findProjectSummaries(userId);
  const annotatedCounts = await Promise.all(projects.map((project) => countAnnotatedImages(project.id)));

  return projects.map((project, index) => serializeProject(project, annotatedCounts[index] ?? 0));
}

export async function getProjectOverview(id: string, userId: string): Promise<ProjectOverview | null> {
  const project = await findProjectSummaryById(id, userId);
  if (!project) return null;

  const [annotatedImages, activities] = await Promise.all([
    countAnnotatedImages(id),
    findProjectActivities(id),
  ]);

  return {
    ...serializeProject(project, annotatedImages),
    activities: activities.map((activity) => ({
      ...activity,
      createdAt: activity.createdAt.toISOString(),
    })),
  };
}

export async function createProject(input: CreateProjectInput, userId: string): Promise<Project> {
  return prisma.$transaction(async (transaction) => {
    const project = await transaction.project.create({
      data: {
        name: input.name,
        description: input.description,
        type: input.type,
        createdById: userId,
      },
    });

    await transaction.activityLog.create({
      data: {
        projectId: project.id,
        type: "PROJECT_CREATED",
        message: `Project “${project.name}” created`,
      },
    });

    return project;
  });
}

export async function deleteProject(id: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: { id, createdById: userId },
    include: { datasets: { select: { storagePath: true } } },
  });
  if (!project) return null;
  await prisma.$transaction(async (transaction) => {
    await transaction.trainingJob.deleteMany({ where: { projectId: id } });
    await transaction.datasetVersion.deleteMany({ where: { projectId: id } });
    await transaction.annotation.deleteMany({ where: { image: { projectId: id } } });
    await transaction.project.delete({ where: { id } });
  });
  await Promise.all([
    removeProjectStorage(id, project.createdById),
    ...project.datasets.map((dataset) => removeStorageDirectory(dataset.storagePath)),
  ]);
  return project;
}
