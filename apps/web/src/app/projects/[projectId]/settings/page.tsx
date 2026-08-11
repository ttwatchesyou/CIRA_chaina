import { notFound } from "next/navigation";

import { ProjectPageHeader } from "@/components/layout/project-page-header";
import { ProjectDeletePanel } from "@/components/project/project-delete-panel";
import { requireUser } from "@/lib/auth";
import { getProjectOverview } from "@/server/services/project.service";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const user = await requireUser();
  const project = await getProjectOverview(projectId, user.id);
  if (!project) notFound();

  return (
    <>
      <ProjectPageHeader eyebrow="การตั้งค่าโปรเจกต์" title="ตั้งค่า" description="ดูรายละเอียดและจัดการข้อมูลของโปรเจกต์" />
      <section className="mt-6 rounded-xl border bg-white p-5 shadow-card">
        <h2 className="text-base font-semibold text-ink">รายละเอียดโปรเจกต์</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-muted">ชื่อโปรเจกต์</dt><dd className="mt-1 font-medium text-ink">{project.name}</dd></div>
          <div><dt className="text-muted">ประเภทโปรเจกต์</dt><dd className="mt-1 font-medium text-ink">Object Detection (ตรวจจับวัตถุ)</dd></div>
          <div className="sm:col-span-2"><dt className="text-muted">รายละเอียด</dt><dd className="mt-1 text-ink">{project.description || "ยังไม่มีรายละเอียด"}</dd></div>
        </dl>
      </section>
      <div className="mt-6"><ProjectDeletePanel projectId={project.id} projectName={project.name} /></div>
    </>
  );
}
