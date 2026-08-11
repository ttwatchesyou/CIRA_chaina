import { notFound } from "next/navigation";

import { ProjectSidebar } from "@/components/layout/project-sidebar";
import { requireUser } from "@/lib/auth";
import { getProjectOverview } from "@/server/services/project.service";

export const dynamic = "force-dynamic";

type ProjectLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
};

export default async function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const { projectId } = await params;
  const user = await requireUser();
  const project = await getProjectOverview(projectId, user.id);
  if (!project) notFound();

  return (
    <div className="min-h-screen bg-canvas md:pl-64">
      <ProjectSidebar projectId={project.id} projectName={project.name} user={user} />
      <main className="mx-auto max-w-7xl px-5 py-6 sm:px-8 lg:px-10">{children}</main>
    </div>
  );
}
