import { BrainCircuit, Cpu, Database, Download, FileJson, Gauge, Layers3, Play, Sparkles } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProjectPageHeader } from "@/components/layout/project-page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { getModelsWorkspace } from "@/server/services/model.service";
import type { ModelItem } from "@/types/model";

export const dynamic = "force-dynamic";

type ModelsPageProps = { params: Promise<{ projectId: string }> };

export default async function ModelsPage({ params }: ModelsPageProps) {
  const { projectId } = await params;
  const user = await requireUser();
  const workspace = await getModelsWorkspace(projectId, user.id);
  if (!workspace) notFound();

  const checkpointCount = workspace.models.filter((model) => !model.simulation).length;
  const bestMap50 = workspace.models.reduce<number | null>((best, model) => model.map50 === null ? best : Math.max(best ?? 0, model.map50), null);

  return (
    <>
      <ProjectPageHeader
        eyebrow="ผลลัพธ์จาก Training"
        title="โมเดล"
        description="ดู Metrics และดาวน์โหลด Checkpoint หรือรายงานผลจากงาน Train ที่สำเร็จ"
        action={<Link href={`/projects/${projectId}/training`} className="action-highlight guide-action inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold"><Play className="size-4 fill-current" />ไปหน้า Train</Link>}
      />

      {workspace.models.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={Layers3}
            title="ยังไม่มีโมเดล"
            description="เมื่อ Train สำเร็จ ไฟล์โมเดลหรือรายงาน Simulation จะมาแสดงในหน้านี้โดยอัตโนมัติ"
            action={<Link href={`/projects/${projectId}/training`} className="action-primary inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold"><Play className="size-4 fill-current" />เริ่ม Train โมเดล</Link>}
          />
        </div>
      ) : (
        <>
          <section className="mt-6 grid gap-3 sm:grid-cols-3">
            <MetricCard icon={Layers3} label="ผลลัพธ์ทั้งหมด" value={`${workspace.models.length}`} />
            <MetricCard icon={BrainCircuit} label="Checkpoint พร้อมใช้" value={`${checkpointCount}`} />
            <MetricCard icon={Gauge} label="mAP50 สูงสุด" value={bestMap50 === null ? "–" : formatPercent(bestMap50)} />
          </section>

          {workspace.models.some((model) => model.simulation) ? (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-[#e6cb72] bg-[#fff9df] p-4 text-sm leading-6 text-[#6f571a]">
              <Sparkles className="mt-0.5 size-5 shrink-0 text-[#947221]" />
              <p><strong>งานที่ระบุว่า Simulation ยังไม่ใช่โมเดลสำหรับ Predict</strong><br />ดาวน์โหลดได้เป็นรายงาน JSON สำหรับตรวจค่าและการตั้งค่า เมื่อเชื่อม Ultralytics จริง ไฟล์ <code>best.pt</code> และ <code>last.pt</code> จะปรากฏในตำแหน่งเดียวกัน</p>
            </div>
          ) : null}

          <section className="mt-6 space-y-4" aria-label="รายการโมเดล">
            {workspace.models.map((model) => <ModelCard key={model.id} model={model} />)}
          </section>
        </>
      )}
    </>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof Layers3; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-white p-4 shadow-card">
      <span className="grid size-10 place-items-center rounded-xl bg-[#eaf3ff] text-[#3f76b5]"><Icon className="size-5 fill-current/10" /></span>
      <div><p className="text-xs text-muted">{label}</p><p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{value}</p></div>
    </div>
  );
}

function ModelCard({ model }: { model: ModelItem }) {
  return (
    <article className="overflow-hidden rounded-2xl border bg-white shadow-card">
      <div className="h-1 bg-gradient-to-r from-[#4f8ac8] via-[#756ab4] to-[#9a73b8]" />
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className={`grid size-12 shrink-0 place-items-center rounded-xl ${model.simulation ? "bg-[#fff2bc] text-[#80601b]" : "bg-[#e8f5ec] text-success"}`}>
              {model.simulation ? <FileJson className="size-6" /> : <BrainCircuit className="size-6" />}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-base font-semibold text-ink sm:text-lg">{model.name}</h2>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${model.simulation ? "bg-[#fff4c9] text-[#80601b]" : "bg-emerald-50 text-emerald-700"}`}>{model.simulation ? "Simulation" : "พร้อมใช้งาน"}</span>
              </div>
              <p className="mt-1 text-sm text-muted">Base model {model.baseModel} · เสร็จ {model.trainingJob.completedAt ? formatRelativeTime(model.trainingJob.completedAt) : formatRelativeTime(model.createdAt)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Metric label="mAP50" value={model.map50 === null ? "–" : formatPercent(model.map50)} />
            <Metric label="mAP50–95" value={model.map50_95 === null ? "–" : formatPercent(model.map50_95)} />
          </div>
        </div>

        <div className="mt-5 grid gap-3 rounded-xl bg-[#f8f7fc] p-4 text-sm text-muted sm:grid-cols-2 xl:grid-cols-4">
          <Detail icon={Database} label="Dataset" value={model.trainingJob.datasets.map((dataset) => `v${dataset.version}`).join(" + ")} />
          <Detail icon={Cpu} label="เครื่อง Train" value={model.trainingJob.workerName || "ไม่พบข้อมูล"} />
          <Detail icon={Gauge} label="ตั้งค่า" value={`${model.trainingJob.epochs} epochs · imgsz ${model.trainingJob.imageSize}`} />
          <Detail icon={Sparkles} label="วันที่สร้าง" value={formatDate(model.createdAt)} />
        </div>

        <div className="mt-5 rounded-xl border border-[#d8d0ec] bg-[#fbfaff] p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-ink">ดาวน์โหลดโฟลเดอร์ผลลัพธ์</h3>
              <p className="mt-1 text-xs text-muted">ไฟล์ {model.archiveFileName} · จัดโครงสร้าง weights และ results ให้พร้อมนำไปใช้ต่อ</p>
            </div>
            <a href={model.archiveDownloadUrl} download className="action-highlight guide-action inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold"><Download className="size-4" />ดาวน์โหลด ZIP</a>
          </div>
          <div className="mt-3 grid gap-2 border-t pt-3 lg:grid-cols-2">
            {model.files.map((file) => (
              <div key={file.kind} className="flex items-center gap-2 text-xs text-muted">
                <span className="size-1.5 rounded-full bg-[#6e84bd]" />
                <span className="font-medium text-ink">{file.label}</span>
                <span>· {file.fileName} · {formatBytes(file.sizeBytes)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-24 rounded-xl border bg-white px-3 py-2 text-right"><p className="text-[11px] text-muted">{label}</p><p className="mt-0.5 text-sm font-semibold tabular-nums text-ink">{value}</p></div>;
}

function Detail({ icon: Icon, label, value }: { icon: typeof Database; label: string; value: string }) {
  return <div className="flex min-w-0 items-center gap-2"><Icon className="size-4 shrink-0 text-[#3f76b5]" /><span className="min-w-0"><span className="block text-[11px]">{label}</span><strong className="block truncate text-xs font-semibold text-ink">{value}</strong></span></div>;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
