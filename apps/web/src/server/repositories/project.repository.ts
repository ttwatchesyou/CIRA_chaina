import db from "@/lib/db";

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
  _count: { images: number; classes: number; datasets: number; models: number; jobs: number };
};

export async function findProjectSummaries(userId: string) {
  const rows = await db("Project as p")
    .select(
      "p.id",
      "p.name",
      "p.description",
      "p.type",
      "p.createdAt",
      "p.updatedAt",
      db.raw(`(select count(*) from "Image" where "projectId" = p.id) as "images"`),
      db.raw(`(select count(*) from "VisionClass" where "projectId" = p.id) as "classes"`),
      db.raw(`(select count(*) from "DatasetVersion" where "projectId" = p.id) as "datasets"`),
      db.raw(`(select count(*) from "ModelArtifact" where "projectId" = p.id) as "models"`),
      db.raw(`(select count(*) from "TrainingJob" where "projectId" = p.id) as "jobs"`),
    )
    .where("p.createdById", userId)
    .orderBy("p.updatedAt", "desc");

  return rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    type: r.type,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    _count: {
      images: Number(r.images ?? 0),
      classes: Number(r.classes ?? 0),
      datasets: Number(r.datasets ?? 0),
      models: Number(r.models ?? 0),
      jobs: Number(r.jobs ?? 0),
    },
  }));
}

export async function findProjectSummaryById(id: string, userId: string) {
  const r = await db("Project as p")
    .select(
      "p.id",
      "p.name",
      "p.description",
      "p.type",
      "p.createdAt",
      "p.updatedAt",
      db.raw(`(select count(*) from "Image" where "projectId" = p.id) as "images"`),
      db.raw(`(select count(*) from "VisionClass" where "projectId" = p.id) as "classes"`),
      db.raw(`(select count(*) from "DatasetVersion" where "projectId" = p.id) as "datasets"`),
      db.raw(`(select count(*) from "ModelArtifact" where "projectId" = p.id) as "models"`),
      db.raw(`(select count(*) from "TrainingJob" where "projectId" = p.id) as "jobs"`),
    )
    .where({ "p.id": id, "p.createdById": userId })
    .first();

  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    type: r.type,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    _count: {
      images: Number(r.images ?? 0),
      classes: Number(r.classes ?? 0),
      datasets: Number(r.datasets ?? 0),
      models: Number(r.models ?? 0),
      jobs: Number(r.jobs ?? 0),
    },
  } as ProjectSummaryRecord;
}

export async function countAnnotatedImages(projectId: string) {
  const row = await db("Image").where({ projectId, status: "ANNOTATED" }).count<{ count: number }>("* as count");
  // knex returns [{"count": number}] for sqlite better-sqlite3 it may return number directly
  const val = Array.isArray(row) ? Number((row as any)[0].count ?? 0) : Number((row as any).count ?? 0);
  return val;
}

export async function findProjectActivities(projectId: string) {
  const rows = await db("ActivityLog").where({ projectId }).orderBy("createdAt", "desc").limit(8).select("id", "type", "message", "createdAt");
  return rows;
}
