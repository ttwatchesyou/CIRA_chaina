import { notFound } from "next/navigation";

import { ProjectOverviewPanel } from "@/components/project/project-overview";
import { requireUser } from "@/lib/auth";
import { getProjectOverview } from "@/server/services/project.service";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const user = await requireUser();
  const project = await getProjectOverview(projectId, user.id);
  if (!project) notFound();
  return <ProjectOverviewPanel project={project} />;
}
