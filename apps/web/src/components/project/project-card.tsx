import { ArrowUpRight, Boxes, CalendarDays, FolderKanban, ImageIcon, Tags } from "lucide-react";
import Link from "next/link";

import { formatRelativeTime } from "@/lib/format";
import type { ProjectSummary } from "@/types/project";

export function ProjectCard({ project }: { project: ProjectSummary }) {
  const annotationRate = project.counts.images === 0 ? 0 : Math.round((project.counts.annotatedImages / project.counts.images) * 100);

  return (
    <Link
      href={`/projects/${project.id}`}
      aria-label={`เปิดโปรเจกต์ ${project.name}`}
      className="group flex min-h-64 flex-col rounded-xl border bg-white p-5 shadow-card transition-all hover:-translate-y-1 hover:border-[#d8d0ec] hover:shadow-[0_18px_40px_rgba(65,51,102,0.14)] focus-visible:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <div className="flex items-start justify-between gap-4">
        <span className="grid size-10 place-items-center rounded-lg bg-[#eaf3ff] text-[#3f76b5]">
          <FolderKanban className="size-5 fill-[#3f76b5]/10" aria-hidden />
        </span>
        <span className="rounded-full border bg-[#f3f0fb] px-2.5 py-1 text-[11px] font-semibold tracking-wide text-primary">ตรวจจับวัตถุ</span>
      </div>
      <div className="mt-5 min-w-0">
        <h2 className="truncate text-base font-semibold text-ink">{project.name}</h2>
        <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-muted">{project.description || "ยังไม่มีรายละเอียดโปรเจกต์"}</p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-y py-3.5">
        <Stat icon={ImageIcon} label="รูปภาพ" value={project.counts.images} />
        <Stat icon={Tags} label="คลาส" value={project.counts.classes} />
        <Stat icon={Boxes} label="Dataset" value={project.counts.datasets} />
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex justify-between text-xs text-muted">
          <span>ความคืบหน้า Annotation</span>
          <span>{project.counts.annotatedImages} / {project.counts.images}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-[#4f83b9] to-[#8069b5]" style={{ width: `${annotationRate}%` }} />
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between pt-5">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted"><CalendarDays className="size-3.5 text-[#3f76b5]" />อัปเดต {formatRelativeTime(project.updatedAt)}</span>
        <span className="guide-action inline-flex items-center gap-1 text-sm font-semibold text-primary group-hover:text-primary-hover">
          เปิดโปรเจกต์ <ArrowUpRight className="size-4" />
        </span>
      </div>
    </Link>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof ImageIcon; label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[11px] text-muted"><Icon className="size-3" />{label}</div>
      <div className="mt-1 text-sm font-semibold tabular-nums text-ink">{value}</div>
    </div>
  );
}
