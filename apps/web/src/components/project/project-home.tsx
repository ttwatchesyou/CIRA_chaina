import { FolderKanban, ImageIcon, Layers3 } from "lucide-react";

import type { ProjectSummary } from "@/types/project";
import { NewProjectDialog } from "./new-project-dialog";
import { ProjectGrid } from "./project-grid";
import { AccountMenu } from "@/components/auth/account-menu";
import type { AuthUser } from "@/types/auth";

export function ProjectHome({ projects, user }: { projects: ProjectSummary[]; user: AuthUser }) {
  const totalImages = projects.reduce((total, project) => total + project.counts.images, 0);
  const totalDatasets = projects.reduce((total, project) => total + project.counts.datasets, 0);

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 py-7 sm:px-8 lg:px-10">
      <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            <span className="size-1.5 rounded-full bg-warning" /> พื้นที่ทำงาน Computer Vision
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">แพลตฟอร์มจัดการ Computer Vision</h1>
          <p className="mt-1.5 text-sm text-muted">จัดการรูปภาพ Annotation, Dataset และงาน Train ไว้ในที่เดียว</p>
        </div>
        <div className="flex items-center gap-3"><AccountMenu user={user} /><NewProjectDialog compact /></div>
      </header>

      <section className="mt-7 grid gap-3 sm:grid-cols-3">
        <OverviewMetric icon={FolderKanban} label="โปรเจกต์" value={projects.length} />
        <OverviewMetric icon={ImageIcon} label="รูปภาพ" value={totalImages} />
        <OverviewMetric icon={Layers3} label="เวอร์ชัน Dataset" value={totalDatasets} />
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink">โปรเจกต์</h2>
            <p className="mt-1 text-sm text-muted">เรียงตามโปรเจกต์ที่อัปเดตล่าสุด</p>
          </div>
          {projects.length > 0 ? <span className="text-sm text-muted">ทั้งหมด {projects.length} โปรเจกต์</span> : null}
        </div>
        <ProjectGrid projects={projects} />
      </section>
    </main>
  );
}

function OverviewMetric({ icon: Icon, label, value }: { icon: typeof FolderKanban; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-white p-4 shadow-card">
      <span className="grid size-9 place-items-center rounded-lg bg-[#eaf3ff] text-[#3f76b5]"><Icon className="size-4 fill-[#3f76b5]/10" /></span>
      <div><p className="text-xs text-muted">{label}</p><p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{value}</p></div>
    </div>
  );
}
