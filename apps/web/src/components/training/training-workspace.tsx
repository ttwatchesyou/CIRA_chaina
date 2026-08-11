"use client";

import { Cpu, Download, LoaderCircle, Play, RefreshCcw, RotateCcw, Server, Square, TerminalSquare } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ProjectPageHeader } from "@/components/layout/project-page-header";
import { ToolGuidePopover } from "@/components/ui/tool-guide-popover";
import { useToast } from "@/components/ui/toast-provider";
import type { ApiFailure, ApiSuccess } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import { TRAINING_MODELS } from "@/lib/training-models";
import { useStepGuide } from "@/lib/use-step-guide";
import type { TrainingJobItem, TrainingJobStatus, TrainingWorkspaceData } from "@/types/training";

const ACTIVE_STATUSES = new Set<TrainingJobStatus>(["QUEUED", "PREPARING", "DOWNLOADING_DATASET", "TRAINING", "VALIDATING", "SAVING_MODEL"]);

export function TrainingWorkspace({ initialData }: { initialData: TrainingWorkspaceData }) {
  const { showToast } = useToast();
  const { activeGuide, dismissGuide, completeGuide } = useStepGuide();
  const [data, setData] = useState(initialData);
  const [submitting, setSubmitting] = useState(false);
  const [datasetVersionIds, setDatasetVersionIds] = useState<string[]>(initialData.datasets[0] ? [initialData.datasets[0].id] : []);
  const [workerId, setWorkerId] = useState(initialData.workers.find((worker) => worker.status === "IDLE")?.id || "");
  const [outputName, setOutputName] = useState(`vision-model-${initialData.jobs.length + 1}`);
  const [baseModel, setBaseModel] = useState<string>(TRAINING_MODELS[0].id);
  const [epochs, setEpochs] = useState(100);
  const [imageSize, setImageSize] = useState(640);
  const [batchSize, setBatchSize] = useState<number>(TRAINING_MODELS[0].defaultBatchSize);

  const refresh = useCallback(async (quiet = true) => {
    try {
      const response = await fetch(`/api/projects/${initialData.projectId}/training/jobs`, { cache: "no-store" });
      const payload = (await response.json()) as ApiSuccess<TrainingWorkspaceData> | ApiFailure;
      if (!("data" in payload)) throw new Error(payload.error.message);
      setData(payload.data);
    } catch (error) {
      if (!quiet) showToast("error", error instanceof Error ? error.message : "โหลดสถานะ Training ไม่สำเร็จ");
    }
  }, [initialData.projectId, showToast]);

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(true), 3_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (datasetVersionIds.length === 0 && data.datasets[0]) setDatasetVersionIds([data.datasets[0].id]);
    if (!workerId) {
      const available = data.workers.find((worker) => worker.status === "IDLE");
      if (available) setWorkerId(available.id);
    }
  }, [data.datasets, data.workers, datasetVersionIds.length, workerId]);

  const selectedWorker = useMemo(() => data.workers.find((worker) => worker.id === workerId), [data.workers, workerId]);
  const canStart = Boolean(datasetVersionIds.length > 0 && workerId && outputName.trim() && selectedWorker && !["OFFLINE", "ERROR"].includes(selectedWorker.status));

  async function startTraining(event: React.FormEvent) {
    event.preventDefault();
    if (!canStart || submitting) return;
    if (activeGuide === "train") completeGuide();
    setSubmitting(true);
    try {
      const response = await fetch(`/api/projects/${data.projectId}/training/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetVersionIds, workerId, outputName: outputName.trim(), baseModel, epochs, imageSize, batchSize, device: "auto" }),
      });
      const payload = (await response.json()) as ApiSuccess<TrainingJobItem> | ApiFailure;
      if (!("data" in payload)) throw new Error(payload.error.message);
      showToast("success", "ส่งงานเข้า Training Queue แล้ว");
      await refresh();
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "สร้างงาน Train ไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  async function controlJob(jobId: string, action: "cancel" | "retry") {
    try {
      const response = await fetch(`/api/training/jobs/${jobId}/${action}`, { method: "POST" });
      const payload = (await response.json()) as ApiSuccess<TrainingJobItem> | ApiFailure;
      if (!("data" in payload)) throw new Error(payload.error.message);
      showToast("success", action === "cancel" ? "ส่งคำขอยกเลิกแล้ว" : "สร้างงาน Retry แล้ว");
      await refresh();
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "ควบคุมงานไม่สำเร็จ");
    }
  }

  return (
    <>
      <ProjectPageHeader eyebrow="เฟส 5–6 · Training" title="Train โมเดล" description="เลือก Dataset และเครื่อง Worker แล้วส่งงานเข้า Queue เพื่อติดตามสถานะจากอีกเครื่อง" />

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.workers.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-white p-5 text-sm text-muted sm:col-span-2 xl:col-span-3">
            ยังไม่พบ Training Worker — เปิด `yarn worker` ที่เครื่อง Train แล้ว Worker จะปรากฏตรงนี้
          </div>
        ) : data.workers.map((worker) => (
          <div key={worker.id} className="rounded-xl border bg-white p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#eaf3ff] text-[#3f76b5]"><Server className="size-5" /></span>
                <div className="min-w-0"><p className="truncate font-semibold text-ink">{worker.hostname}</p><p className="truncate text-xs text-muted">{worker.gpu || worker.cpu || "กำลังอ่านข้อมูลเครื่อง"}</p></div>
              </div>
              <WorkerStatusBadge status={worker.status} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted">
              <span>RAM {formatMb(worker.ramUsedMb)} / {formatMb(worker.ramTotalMb)}</span>
              <span>VRAM {formatMb(worker.gpuMemoryUsedMb)} / {formatMb(worker.gpuMemoryMb)}</span>
            </div>
            <p className="mt-3 text-xs text-muted">Heartbeat {worker.lastHeartbeatAt ? formatRelativeTime(worker.lastHeartbeatAt) : "ยังไม่เคยส่ง"}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-xl border bg-white p-5 shadow-card sm:p-6">
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-lg bg-[#edf2ff] text-primary"><Cpu className="size-5" /></span><div><h2 className="font-semibold text-ink">สร้าง Training job</h2><p className="text-sm text-muted">ค่าชุดแรกเป็นค่าเริ่มต้นสำหรับ YOLO และแก้ได้ก่อนส่งงาน</p></div></div>
        <form onSubmit={startTraining} className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="md:col-span-2 xl:col-span-3">
            <Field label={`Dataset versions · เลือกแล้ว ${datasetVersionIds.length} รายการ`}>
              <div className="grid gap-2 rounded-lg border bg-[#faf9fd] p-3 sm:grid-cols-2 xl:grid-cols-3">
                {data.datasets.length === 0 ? <p className="text-sm text-muted">ยังไม่มี Dataset ที่พร้อมใช้</p> : data.datasets.map((dataset) => (
                  <label key={dataset.id} className="flex cursor-pointer items-start gap-2 rounded-lg border bg-white p-3 text-sm hover:border-[#bdb3da]">
                    <input
                      type="checkbox"
                      checked={datasetVersionIds.includes(dataset.id)}
                      onChange={() => setDatasetVersionIds((current) => current.includes(dataset.id) ? current.filter((id) => id !== dataset.id) : [...current, dataset.id])}
                      className="mt-0.5 size-4 accent-[#6d63a9]"
                    />
                    <span><strong className="block text-ink">v{dataset.version} · {dataset.name}</strong><span className="text-xs text-muted">{dataset.imageCount} รูป · {dataset.imageSize ? `${dataset.imageSize}×${dataset.imageSize}` : "ขนาดต้นฉบับ"}</span></span>
                  </label>
                ))}
              </div>
              <span className="mt-2 block text-xs text-muted">ระบบจะรวม Class ที่ชื่อเดียวกัน รีแมปเลข Class และเติมคำนำหน้าชื่อไฟล์ให้อัตโนมัติ</span>
            </Field>
          </div>
          <Field label="Training computer"><select value={workerId} onChange={(event) => setWorkerId(event.target.value)} className="field-control"><option value="">เลือก Worker</option>{data.workers.map((worker) => <option key={worker.id} value={worker.id} disabled={worker.status === "OFFLINE" || worker.status === "ERROR"}>{worker.hostname} · {worker.status}</option>)}</select></Field>
          <Field label="Model"><select value={baseModel} onChange={(event) => { const model = TRAINING_MODELS.find((item) => item.id === event.target.value); setBaseModel(event.target.value); if (model) setBatchSize(model.defaultBatchSize); }} className="field-control">{TRAINING_MODELS.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}</select></Field>
          <div className="md:col-span-2 xl:col-span-3">
            <Field label="ชื่อโฟลเดอร์ผลลัพธ์">
              <input type="text" maxLength={80} value={outputName} onChange={(event) => setOutputName(event.target.value)} placeholder="เช่น ตรวจจับรถ-v1" className="field-control" />
              <span className="mt-2 block text-xs text-muted">เมื่อ Train จริงจะได้ไฟล์ <strong className="text-ink">{outputName.trim() || "ชื่อที่ตั้ง"}.zip</strong> ภายในมีโฟลเดอร์ <code>weights/best.pt</code> และ <code>weights/last.pt</code></span>
            </Field>
          </div>
          <Field label="Epochs"><input type="number" min={1} max={10_000} value={epochs} onChange={(event) => setEpochs(Number(event.target.value))} className="field-control" /></Field>
          <Field label="Image size"><input type="number" min={32} max={4_096} step={32} value={imageSize} onChange={(event) => setImageSize(Number(event.target.value))} className="field-control" /></Field>
          <Field label="Batch size"><input type="number" min={1} max={1_024} value={batchSize} onChange={(event) => setBatchSize(Number(event.target.value))} className="field-control" /></Field>
          <div className="relative md:col-span-2 xl:col-span-3">
            <button type="submit" disabled={!canStart || submitting} className="action-primary guide-action inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">{submitting ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-4 fill-current" />}{submitting ? "กำลังส่งงาน" : "เริ่ม Train"}</button>
            {activeGuide === "train" ? <ToolGuidePopover title="ตั้งค่าแล้วเริ่ม Train ตรงนี้" description="เลือก Dataset และเครื่อง Worker ก่อน จากนั้นตรวจค่า Model, Epochs, Image size และ Batch size แล้วกดเริ่ม Train" onDismiss={dismissGuide} placement="below-left" /> : null}
          </div>
        </form>
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between"><div><h2 className="font-semibold text-ink">Training Queue</h2><p className="mt-1 text-sm text-muted">อัปเดตสถานะอัตโนมัติทุก 3 วินาที</p></div><button type="button" onClick={() => void refresh(false)} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm text-ink hover:bg-slate-50"><RefreshCcw className="size-4" />รีเฟรช</button></div>
        <div className="mt-3 space-y-3">
          {data.jobs.length === 0 ? <div className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-muted">ยังไม่มี Training job</div> : data.jobs.map((job) => <TrainingJobCard key={job.id} job={job} projectId={data.projectId} onControl={controlJob} />)}
        </div>
      </section>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>{children}</label>;
}

function TrainingJobCard({ job, projectId, onControl }: { job: TrainingJobItem; projectId: string; onControl: (jobId: string, action: "cancel" | "retry") => Promise<void> }) {
  const active = ACTIVE_STATUSES.has(job.status);
  const canRetry = job.status === "FAILED" || job.status === "CANCELLED";
  return (
    <article className="rounded-xl border bg-white p-4 shadow-card sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><TrainingStatusBadge status={job.status} /><strong className="text-sm text-ink">{job.outputName}</strong><span className="text-xs text-muted">{job.baseModel} · Dataset {job.datasets.map((dataset) => `v${dataset.version}`).join(" + ")}</span></div><p className="mt-2 text-sm text-muted">{job.lastMessage || "รอข้อมูลจาก Worker"} · {job.worker?.hostname || "ไม่พบ Worker"}</p></div>
        <div className="flex gap-2">{active ? <button type="button" onClick={() => void onControl(job.id, "cancel")} disabled={Boolean(job.cancelRequestedAt)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-danger disabled:opacity-50"><Square className="size-3.5 fill-current" />{job.cancelRequestedAt ? "กำลังยกเลิก" : "ยกเลิก"}</button> : null}{canRetry ? <button type="button" onClick={() => void onControl(job.id, "retry")} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-ink"><RotateCcw className="size-4" />Retry</button> : null}{job.status === "COMPLETED" ? <Link href={`/projects/${projectId}/models`} className="action-highlight guide-action inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold"><Download className="size-4" />ดูไฟล์โมเดล</Link> : null}</div>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-muted"><span>Epoch {job.currentEpoch} / {job.epochs}</span><span>{Math.round(job.progress)}%</span></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-[#4f8ac8] to-[#8068b4] transition-[width]" style={{ width: `${Math.min(job.progress, 100)}%` }} /></div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-muted sm:grid-cols-4"><span>imgsz {job.imageSize}</span><span>batch {job.batchSize}</span><span>mAP50 {formatMetric(job.metrics.map50)}</span><span>loss {formatMetric(job.metrics.loss)}</span></div>
      {job.logs.length > 0 ? <details className="mt-4 rounded-lg bg-[#172234] text-slate-200"><summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs"><TerminalSquare className="size-4" />Training log ({job.logs.length})</summary><div className="max-h-44 overflow-auto border-t border-white/10 px-3 py-2 font-mono text-[11px] leading-5">{job.logs.map((log) => <p key={log.id}><span className="text-slate-400">[{new Date(log.createdAt).toLocaleTimeString("th-TH")}]</span> {log.message}</p>)}</div></details> : null}
    </article>
  );
}

function WorkerStatusBadge({ status }: { status: TrainingWorkspaceData["workers"][number]["status"] }) {
  const classes = status === "IDLE" ? "bg-emerald-50 text-emerald-700" : status === "BUSY" ? "bg-amber-50 text-amber-700" : status === "ERROR" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-500";
  const label = status === "IDLE" ? "พร้อมใช้" : status === "BUSY" ? "กำลังทำงาน" : status === "ERROR" ? "ผิดพลาด" : "ออฟไลน์";
  return <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${classes}`}>{label}</span>;
}

function TrainingStatusBadge({ status }: { status: TrainingJobStatus }) {
  const terminalClass = status === "COMPLETED" ? "bg-emerald-50 text-emerald-700" : status === "FAILED" ? "bg-red-50 text-red-700" : status === "CANCELLED" ? "bg-slate-100 text-slate-600" : "bg-blue-50 text-blue-700";
  return <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${terminalClass}`}>{statusLabels[status]}</span>;
}

function formatMb(value: number | null) {
  if (value === null) return "–";
  return value >= 1024 ? `${(value / 1024).toFixed(1)} GB` : `${value} MB`;
}

function formatMetric(value: number | undefined) {
  return value === undefined ? "–" : value.toFixed(3);
}

const statusLabels: Record<TrainingJobStatus, string> = {
  QUEUED: "รอคิว",
  PREPARING: "เตรียมงาน",
  DOWNLOADING_DATASET: "โหลด Dataset",
  TRAINING: "กำลัง Train",
  VALIDATING: "Validation",
  SAVING_MODEL: "บันทึกโมเดล",
  COMPLETED: "สำเร็จ",
  FAILED: "ไม่สำเร็จ",
  CANCELLED: "ยกเลิกแล้ว",
};
