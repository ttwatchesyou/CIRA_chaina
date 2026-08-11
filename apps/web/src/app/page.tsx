import { ProjectHome } from "@/components/project/project-home";
import { requireUser } from "@/lib/auth";
import { listProjects } from "@/server/services/project.service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireUser();
  const projects = await listProjects(user.id);
  return <ProjectHome projects={projects} user={user} />;
}
