"use client";

import {
  Boxes,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Database,
  Download,
  HardDrive,
  Images,
  LoaderCircle,
  Maximize2,
  Play,
  Plus,
  RotateCcw,
  Split,
  Tags,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { NextStepPrompt } from "@/components/ui/next-step-prompt";
import { ToolGuidePopover } from "@/components/ui/tool-guide-popover";
import { useToast } from "@/components/ui/toast-provider";
import type { ApiFailure, ApiSuccess } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import { formatByteSize } from "@/lib/image-validation";
import { useStepGuide } from "@/lib/use-step-guide";
import type { DatasetVersionItem, DatasetWorkspaceData, GenerateDatasetInput } from "@/types/dataset";

export function DatasetWorkspace({ projectId }: { projectId: string }) {
  const { showToast } = useToast();
  const { activeGuide, flowActive, dismissGuide, completeGuide, showGuide } = useStepGuide();
  const [workspace, setWorkspace] = useState<DatasetWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DatasetVersionItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadWorkspace = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/datasets`, { cache: "no-store" });
      const payload = await response.json() as ApiSuccess<DatasetWorkspaceData> | ApiFailure;
      if (!response.ok || !("data" in payload)) throw new Error(apiMessage(payload, "ไม่สามารถโหลด Dataset ได้"));
      setWorkspace(payload.data);
      setLoadError(false);
    } catch (error) {
      setLoadError(true);
      if (!showLoader) showToast("error", error instanceof Error ? error.message : "ไม่สามารถรีเฟรช Dataset ได้");
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [projectId, showToast]);

  useEffect(() => {
    void loadWorkspace(true);
  }, [loadWorkspace]);

  async function generateDataset(input: GenerateDatasetInput) {
    if (generating) return;
    setGenerating(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/datasets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = await response.json() as ApiSuccess<DatasetVersionItem> | ApiFailure;
      if (!response.ok || !("data" in payload)) throw new Error(apiMessage(payload, "ไม่สามารถสร้าง Dataset ได้"));
      setGenerateOpen(false);
      await loadWorkspace(false);
      showToast("success", `Dataset v${payload.data.version} พร้อมดาวน์โหลดแล้ว`);
      if (flowActive) showGuide("train-next");
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "ไม่สามารถสร้าง Dataset ได้");
    } finally {
      setGenerating(false);
    }
  }

  async function deleteDataset() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/datasets/${deleteTarget.id}`, { method: "DELETE" });
      const payload = await response.json() as ApiSuccess<{ id: string }> | ApiFailure;
      if (!response.ok || !("data" in payload)) throw new Error(apiMessage(payload, "ไม่สามารถลบ Dataset ได้"));
      showToast("success", `ลบ Dataset v${deleteTarget.version} แล้ว`);
      setDeleteTarget(null);
      await loadWorkspace(false);
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "ไม่สามารถลบ Dataset ได้");
    } finally {
      setDeleting(false);
    }
  }

  function openGenerateDialog() {
    if (activeGuide === "dataset") completeGuide();
    setGenerateOpen(true);
  }

  if (loading) return <DatasetLoading />;
  if (loadError && !workspace) {
    return <EmptyState icon={TriangleAlert} title="โหลด Dataset ไม่สำเร็จ" description="ตรวจการเชื่อมต่อ Server แล้วลองอีกครั้ง" action={<button type="button" onClick={() => void loadWorkspace(true)} className="action-primary guide-action inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"><RotateCcw className="size-4" />ลองอีกครั้ง</button>} />;
  }
  if (!workspace) return null;

  const canGenerate = workspace.annotatedImageCount > 0 && workspace.classCount > 0;

  return (
    <div>
      <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.1em] text-primary">จัดการ Dataset</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">เวอร์ชัน Dataset</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">สร้างชุดข้อมูล YOLO จากรูปที่ทำ Annotation แล้ว แต่ละเวอร์ชันจะเก็บเป็น Snapshot และไม่เปลี่ยนตามข้อมูลต้นฉบับ</p>
        </div>
        <div className="relative shrink-0">
          <button type="button" disabled={!canGenerate} onClick={openGenerateDialog} className="action-highlight guide-action inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"><Plus className="size-4" />สร้าง Dataset</button>
          {activeGuide === "dataset" ? <ToolGuidePopover title="สร้าง Dataset ตรงนี้" description="กดปุ่มนี้เพื่อเลือกขนาดรูป แบ่ง Train, Validation และ Test แล้วสร้างไฟล์ YOLO" onDismiss={dismissGuide} placement="below-right" /> : null}
        </div>
      </header>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={Database} label="เวอร์ชัน Dataset" value={workspace.datasets.length} />
        <SummaryCard icon={Images} label="รูปที่ทำ Annotation" value={workspace.annotatedImageCount} />
        <SummaryCard icon={Boxes} label="กรอบ Annotation" value={workspace.annotationCount} />
        <SummaryCard icon={Tags} label="คลาส" value={workspace.classCount} />
      </div>

      {!canGenerate ? (
        <div className="mt-5 flex flex-col gap-3 rounded-xl border border-[#ead9b5] bg-[#fffaf0] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3"><TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" /><div><p className="text-sm font-semibold text-ink">ต้องทำ Annotation ก่อน</p><p className="mt-1 text-xs leading-5 text-muted">สร้างอย่างน้อย 1 คลาส และตีกรอบอย่างน้อย 1 รูปก่อนสร้าง Dataset</p></div></div>
          <Link href={`/projects/${projectId}/annotate`} className="guide-action inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border bg-white px-3 py-2 text-center text-sm font-semibold text-ink hover:bg-slate-50">ไปหน้า Annotation<ArrowRight className="size-4" /></Link>
        </div>
      ) : null}

      <section className="mt-8">
        <div className="flex items-center justify-between border-b pb-3"><div><h2 className="text-base font-semibold text-ink">เวอร์ชันที่สร้างแล้ว</h2><p className="mt-1 text-sm text-muted">แต่ละเวอร์ชันเก็บรูป Label, Split และรายชื่อคลาสแยกกัน</p></div></div>
        {workspace.datasets.length === 0 ? (
          <EmptyState icon={Database} title="ยังไม่มีเวอร์ชัน Dataset" description={canGenerate ? "สร้าง YOLO Dataset แรกจาก Annotation ปัจจุบัน" : "ทำ Annotation ให้เรียบร้อยก่อนสร้างเวอร์ชันแรก"} action={canGenerate ? <button type="button" onClick={openGenerateDialog} className="action-highlight guide-action rounded-lg px-4 py-2 text-sm font-semibold">สร้าง Dataset v{workspace.nextVersion}</button> : undefined} />
        ) : (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {workspace.datasets.map((dataset) => <DatasetCard key={dataset.id} dataset={dataset} projectId={projectId} onDelete={() => setDeleteTarget(dataset)} />)}
          </div>
        )}
      </section>

      {generateOpen ? <GenerateDatasetDialog nextVersion={workspace.nextVersion} sourceImages={workspace.annotatedImageCount} annotationCount={workspace.annotationCount} classCount={workspace.classCount} generating={generating} onClose={() => { if (!generating) setGenerateOpen(false); }} onGenerate={generateDataset} /> : null}
      {deleteTarget ? <DeleteDatasetDialog dataset={deleteTarget} deleting={deleting} onClose={() => { if (!deleting) setDeleteTarget(null); }} onConfirm={deleteDataset} /> : null}
      {activeGuide === "train-next" ? <NextStepPrompt title="Dataset พร้อมแล้ว ไป Train ต่อ" description="สร้างไฟล์ Dataset สำเร็จแล้ว ขั้นถัดไปคือเลือก Dataset และเครื่อง Worker เพื่อเริ่ม Train โมเดล" href={`/projects/${projectId}/training?guide=train&tour=1`} actionLabel="ไปหน้า Train" onDismiss={dismissGuide} /> : null}
    </div>
  );
}

function DatasetCard({ dataset, projectId, onDelete }: { dataset: DatasetVersionItem; projectId: string; onDelete: () => void }) {
  return (
    <article className="overflow-hidden rounded-xl border bg-white shadow-card">
      <div className="flex items-start justify-between gap-4 border-b p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-[#f0ecfa] px-2 py-1 text-xs font-bold text-primary">v{dataset.version}</span><span className="rounded-md border px-2 py-1 text-[10px] font-semibold tracking-wide text-muted">YOLO</span><span className="inline-flex items-center gap-1 text-[11px] font-medium text-success"><CheckCircle2 className="size-3.5" />พร้อมใช้</span></div>
          <h3 className="mt-3 truncate text-base font-semibold text-ink" title={dataset.name}>{dataset.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted"><span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5 text-[#3f76b5]" />สร้าง {formatRelativeTime(dataset.createdAt)}</span><span className="inline-flex items-center gap-1.5"><Maximize2 className="size-3.5 text-[#3f76b5]" />{dataset.imageSize ? `${dataset.imageSize} × ${dataset.imageSize}` : "ขนาดต้นฉบับ"}</span></div>
        </div>
        <button type="button" onClick={onDelete} className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-[#faecec] hover:text-danger" aria-label={`ลบ Dataset v${dataset.version}`}><Trash2 className="size-4" /></button>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-3 gap-2">
          <Metric label="รูปภาพ" value={dataset.imageCount} />
          <Metric label="คลาส" value={dataset.classCount} />
          <Metric label="กรอบ" value={dataset.annotationCount} />
        </div>
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs"><span className="inline-flex items-center gap-1.5 font-semibold text-ink"><Split className="size-3.5 text-[#3f76b5]" />สัดส่วน Dataset</span><span className="inline-flex items-center gap-1 text-muted"><HardDrive className="size-3.5 text-[#3f76b5]" />{formatByteSize(dataset.byteSize)}</span></div>
          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-100">
            <span className="bg-primary" style={{ width: `${dataset.trainPercent}%` }} />
            <span className="bg-[#8cadbe]" style={{ width: `${dataset.validationPercent}%` }} />
            <span className="bg-[#c6d6df]" style={{ width: `${dataset.testPercent}%` }} />
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
            <SplitLabel color="bg-primary" label="Train" count={dataset.trainImageCount} percent={dataset.trainPercent} />
            <SplitLabel color="bg-[#8cadbe]" label="Validation" count={dataset.validationImageCount} percent={dataset.validationPercent} />
            <SplitLabel color="bg-[#c6d6df]" label="Test" count={dataset.testImageCount} percent={dataset.testPercent} />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2 border-t pt-4 sm:flex-row">
          <a href={`/api/datasets/${dataset.id}/download`} className="action-primary guide-action inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold"><Download className="size-3.5" />ดาวน์โหลด ZIP</a>
          <Link href={`/projects/${projectId}/training?dataset=${dataset.id}`} className="guide-action inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border bg-white px-3 text-xs font-semibold text-ink hover:bg-slate-50"><Play className="size-3.5" />นำไป Train</Link>
        </div>
        {dataset.trainingJobCount > 0 ? <p className="mt-3 text-[11px] text-muted">Dataset นี้ถูกใช้ในงาน Train {dataset.trainingJobCount} งาน จึงไม่สามารถลบได้</p> : null}
      </div>
    </article>
  );
}

function GenerateDatasetDialog({ nextVersion, sourceImages, annotationCount, classCount, generating, onClose, onGenerate }: {
  nextVersion: number;
  sourceImages: number;
  annotationCount: number;
  classCount: number;
  generating: boolean;
  onClose: () => void;
  onGenerate: (input: GenerateDatasetInput) => Promise<void>;
}) {
  const [name, setName] = useState(`Dataset v${nextVersion}`);
  const [imageSize, setImageSize] = useState<GenerateDatasetInput["imageSize"]>(null);
  const [trainPercent, setTrainPercent] = useState(80);
  const [validationPercent, setValidationPercent] = useState(15);
  const [testPercent, setTestPercent] = useState(5);
  const total = trainPercent + validationPercent + testPercent;
  const valid = name.trim().length >= 2 && total === 100 && trainPercent >= 1;

  function updatePercent(setter: (value: number) => void, rawValue: string) {
    const value = Number(rawValue);
    setter(Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0);
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="generate-dataset-title" className="fixed inset-0 z-50 grid place-items-center bg-[#101923]/55 p-4 backdrop-blur-[2px]">
      <form onSubmit={(event) => { event.preventDefault(); if (valid) void onGenerate({ name: name.trim(), imageSize, trainPercent, validationPercent, testPercent }); }} className="w-full max-w-xl overflow-hidden rounded-2xl border bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b px-6 py-5"><div><p className="text-xs font-semibold tracking-[0.1em] text-primary">สร้าง Dataset v{nextVersion}</p><h2 id="generate-dataset-title" className="mt-1 text-xl font-semibold text-ink">สร้าง YOLO Dataset</h2><p className="mt-1 text-sm text-muted">ระบบจะสร้างสำเนา Annotation ปัจจุบันแบบ Snapshot ที่แก้ไขย้อนหลังไม่ได้</p></div><button type="button" onClick={onClose} disabled={generating} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-slate-100 hover:text-ink disabled:opacity-50" aria-label="ปิด"><X className="size-4" /></button></div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          <label className="block"><span className="text-sm font-semibold text-ink">ชื่อ Dataset</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={100} className="mt-2 h-10 w-full rounded-lg border bg-white px-3 text-sm text-ink" /></label>

          <div className="mt-5 rounded-xl border bg-slate-50 p-4">
            <p className="text-xs font-semibold tracking-[0.08em] text-muted">ข้อมูลต้นทาง</p>
            <div className="mt-3 grid grid-cols-3 gap-3"><Metric label="รูปภาพ" value={sourceImages} /><Metric label="คลาส" value={classCount} /><Metric label="กรอบ" value={annotationCount} /></div>
          </div>

          <div className="mt-5">
            <div><span className="text-sm font-semibold text-ink">ขนาดรูปภาพ</span><p className="mt-1 text-xs leading-5 text-muted">ใช้ขนาดเดียวกันกับ Train, Validation และ Test รูปจะรักษาสัดส่วนเดิมและเติมขอบแบบ Letterbox</p></div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {([
                { value: null, label: "ต้นฉบับ", note: "ให้ YOLO ปรับ" },
                { value: 120, label: "120 × 120", note: "เล็ก / เร็ว" },
                { value: 320, label: "320 × 320", note: "สมดุล" },
                { value: 640, label: "640 × 640", note: "มาตรฐาน" },
              ] as const).map((option) => {
                const selected = imageSize === option.value;
                return <button key={option.label} type="button" onClick={() => setImageSize(option.value)} className={`rounded-xl border p-3 text-left transition-colors ${selected ? "border-primary bg-[#f0ecfa] ring-1 ring-primary" : "bg-white hover:bg-slate-50"}`}><span className={`block text-xs font-semibold ${selected ? "text-primary" : "text-ink"}`}>{option.label}</span><span className="mt-1 block text-[10px] text-muted">{option.note}</span></button>;
              })}
            </div>
            <p className="mt-2 text-xs text-muted">แนะนำขนาดต้นฉบับหากจะกำหนด `imgsz` ตอน Train ภายหลัง เลือกขนาดคงที่เมื่อต้องการไฟล์สี่เหลี่ยมพร้อมใช้งาน</p>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between"><span className="text-sm font-semibold text-ink">แบ่งสัดส่วน Dataset</span><span className={`rounded-full px-2 py-1 text-xs font-bold ${total === 100 ? "bg-[#e9f1eb] text-success" : "bg-[#faecec] text-danger"}`}>{total}%</span></div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <PercentInput label="Train" value={trainPercent} color="border-primary" onChange={(value) => updatePercent(setTrainPercent, value)} />
              <PercentInput label="Validation" value={validationPercent} color="border-[#8cadbe]" onChange={(value) => updatePercent(setValidationPercent, value)} />
              <PercentInput label="Test" value={testPercent} color="border-[#c6d6df]" onChange={(value) => updatePercent(setTestPercent, value)} />
            </div>
            {total !== 100 ? <p className="mt-2 text-xs font-medium text-danger">Train, Validation และ Test ต้องรวมกันเป็น 100%</p> : <p className="mt-2 text-xs text-muted">ค่าแนะนำปัจจุบัน: Train 80%, Validation 15%, Test 5% สามารถแก้ก่อนสร้างได้</p>}
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} disabled={generating} className="h-10 rounded-lg border bg-white px-4 text-sm font-semibold text-ink hover:bg-slate-50 disabled:opacity-50">ยกเลิก</button><button type="submit" disabled={!valid || generating} className="action-highlight guide-action inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">{generating ? <><LoaderCircle className="size-4 animate-spin" />กำลังสร้างไฟล์…</> : <><Database className="size-4" />สร้าง Dataset v{nextVersion}</>}</button></div>
      </form>
    </div>
  );
}

function DeleteDatasetDialog({ dataset, deleting, onClose, onConfirm }: { dataset: DatasetVersionItem; deleting: boolean; onClose: () => void; onConfirm: () => Promise<void> }) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="delete-dataset-title" className="fixed inset-0 z-50 grid place-items-center bg-[#101923]/55 p-4 backdrop-blur-[2px]">
      <section className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-2xl">
        <span className="grid size-11 place-items-center rounded-xl bg-[#faecec] text-danger"><Trash2 className="size-5" /></span>
        <h2 id="delete-dataset-title" className="mt-4 text-lg font-semibold text-ink">ลบ Dataset v{dataset.version} หรือไม่?</h2>
        <p className="mt-2 text-sm leading-6 text-muted">“{dataset.name}” พร้อมรูปที่สร้าง, YOLO Label และ Metadata จะถูกลบถาวร แต่รูปต้นฉบับและ Annotation ในโปรเจกต์จะไม่เปลี่ยนแปลง</p>
        {dataset.trainingJobCount > 0 ? <p className="mt-3 rounded-lg bg-[#fffaf0] p-3 text-xs leading-5 text-warning">เวอร์ชันนี้เชื่อมกับงาน Train อยู่ Server จึงไม่อนุญาตให้ลบ</p> : null}
        <div className="mt-6 flex justify-end gap-2"><button type="button" disabled={deleting} onClick={onClose} className="h-10 rounded-lg border bg-white px-4 text-sm font-semibold text-ink hover:bg-slate-50 disabled:opacity-50">ยกเลิก</button><button type="button" disabled={deleting || dataset.trainingJobCount > 0} onClick={() => void onConfirm()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-danger px-4 text-sm font-semibold text-white disabled:opacity-50">{deleting ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}ลบเวอร์ชัน</button></div>
      </section>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: typeof Database; label: string; value: number }) {
  return <div className="rounded-xl border bg-white p-4 shadow-card"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-[#eaf3ff] text-[#3f76b5]"><Icon className="size-4 fill-[#3f76b5]/10" /></span><div><p className="text-xs text-muted">{label}</p><p className="mt-0.5 text-xl font-semibold tabular-nums text-ink">{value}</p></div></div></div>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div><p className="text-[11px] text-muted">{label}</p><p className="mt-0.5 text-base font-semibold tabular-nums text-ink">{value}</p></div>;
}

function SplitLabel({ color, label, count, percent }: { color: string; label: string; count: number; percent: number }) {
  return <div><p className="flex items-center gap-1.5 text-muted"><span className={`size-1.5 rounded-full ${color}`} />{label}</p><p className="mt-0.5 font-semibold tabular-nums text-ink">{count} <span className="font-normal text-muted">({percent}%)</span></p></div>;
}

function PercentInput({ label, value, color, onChange }: { label: string; value: number; color: string; onChange: (value: string) => void }) {
  return <label className={`rounded-lg border-l-4 bg-slate-50 p-3 ${color}`}><span className="text-xs font-semibold text-ink">{label}</span><span className="mt-2 flex items-center"><input type="number" min={0} max={100} value={value} onChange={(event) => onChange(event.target.value)} className="h-9 min-w-0 flex-1 rounded-l-md border bg-white px-2 text-sm font-semibold tabular-nums text-ink" /><span className="grid h-9 w-8 place-items-center rounded-r-md border border-l-0 bg-white text-xs text-muted">%</span></span></label>;
}

function DatasetLoading() {
  return <div><div className="h-7 w-48 animate-pulse rounded bg-slate-200" /><div className="mt-3 h-4 w-96 max-w-full animate-pulse rounded bg-slate-200" /><div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl border bg-white" />)}</div><div className="mt-8 grid gap-4 xl:grid-cols-2">{[0, 1].map((item) => <div key={item} className="h-80 animate-pulse rounded-xl border bg-white" />)}</div></div>;
}

function apiMessage(payload: ApiSuccess<unknown> | ApiFailure, fallback: string) {
  return "error" in payload ? payload.error.message : fallback;
}
