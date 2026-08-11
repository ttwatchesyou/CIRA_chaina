import { FolderOpen } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import type { ProjectSummary } from "@/types/project";
import { NewProjectDialog } from "./new-project-dialog";
import { ProjectCard } from "./project-card";

export function ProjectGrid({ projects }: { projects: ProjectSummary[] }) {
  if (projects.length === 0) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="ยังไม่มีโปรเจกต์"
        description="สร้างโปรเจกต์แรกเพื่ออัปโหลดรูป ตีกรอบวัตถุ และสร้าง Dataset สำหรับ Train"
        action={<NewProjectDialog label="สร้างโปรเจกต์แรก" />}
      />
    );
  }

  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{projects.map((project) => <ProjectCard key={project.id} project={project} />)}</div>;
}
