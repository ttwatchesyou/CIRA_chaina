"use client";

import { CheckCircle2, FileImage, FolderUp, ImagePlus, LoaderCircle, Trash2, UploadCloud, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ImageLibrary } from "@/components/upload/image-library";
import { MobileUploadDialog } from "@/components/upload/mobile-upload-dialog";
import { ProjectPageHeader } from "@/components/layout/project-page-header";
import { NextStepPrompt } from "@/components/ui/next-step-prompt";
import { ToolGuidePopover } from "@/components/ui/tool-guide-popover";
import { useToast } from "@/components/ui/toast-provider";
import type { ApiFailure, ApiSuccess } from "@/lib/api";
import { formatByteSize, MAX_IMAGE_SIZE_BYTES, MAX_ZIP_UPLOAD_BYTES } from "@/lib/image-validation";
import { useStepGuide } from "@/lib/use-step-guide";
import type { UploadImagesResult } from "@/types/image";

type QueueStatus = "WAITING" | "UPLOADING" | "COMPLETE" | "DUPLICATE" | "FAILED";

type QueueItem = {
  id: string;
  file: File;
  displayName: string;
  status: QueueStatus;
  message?: string;
};

export function UploadWorkspace({ projectId }: { projectId: string }) {
  const { showToast } = useToast();
  const { activeGuide, flowActive, dismissGuide, completeGuide, showGuide } = useStepGuide();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    folderInputRef.current?.setAttribute("webkitdirectory", "");
    folderInputRef.current?.setAttribute("directory", "");
  }, []);

  function queueFiles(files: FileList | File[]) {
    const newItems = Array.from(files).map((file) => ({
      id: globalThis.crypto.randomUUID(),
      file,
      displayName: file.webkitRelativePath || file.name,
      status: "WAITING" as const,
    }));
    if (newItems.length === 0) return;
    setQueue((current) => [...current, ...newItems]);
    if (flowActive) showGuide("upload-submit");
  }

  function updateQueueItem(id: string, update: Partial<QueueItem>) {
    setQueue((current) => current.map((item) => item.id === id ? { ...item, ...update } : item));
  }

  async function uploadOne(item: QueueItem) {
    updateQueueItem(item.id, { status: "UPLOADING", message: undefined });
    const formData = new FormData();
    formData.append("files", item.file, item.file.name);

    try {
      const response = await fetch(`/api/projects/${projectId}/images`, { method: "POST", body: formData });
      const payload = (await response.json()) as ApiSuccess<UploadImagesResult> | ApiFailure;
      if (!("data" in payload)) {
        updateQueueItem(item.id, { status: "FAILED", message: payload.error.message });
        return "FAILED" as const;
      }

      if (payload.data.items.length === 0) {
        updateQueueItem(item.id, { status: "FAILED", message: "Server ไม่ได้ส่งผลการอัปโหลดกลับมา" });
        return "FAILED" as const;
      }
      const itemStatus = payload.data.completed > 0
        ? "COMPLETE"
        : payload.data.duplicates > 0
          ? "DUPLICATE"
          : "FAILED";
      const itemMessage = item.file.name.toLowerCase().endsWith(".zip")
        ? `สำเร็จ ${payload.data.completed} · ซ้ำ ${payload.data.duplicates} · ไม่สำเร็จ ${payload.data.failed}`
        : payload.data.items[0]?.message;
      updateQueueItem(item.id, { status: itemStatus, message: itemMessage });
      return itemStatus;
    } catch {
      updateQueueItem(item.id, { status: "FAILED", message: "เชื่อมต่อเครือข่ายไม่สำเร็จ กรุณาลองอีกครั้ง" });
      return "FAILED" as const;
    }
  }

  async function startUpload() {
    const waiting = queue.filter((item) => item.status === "WAITING" || item.status === "FAILED");
    if (waiting.length === 0) return;
    setUploading(true);

    let completed = 0;
    let duplicates = 0;
    let failed = 0;
    for (const item of waiting) {
      const status = await uploadOne(item);
      if (status === "COMPLETE") completed += 1;
      if (status === "DUPLICATE") duplicates += 1;
      if (status === "FAILED") failed += 1;
    }

    setUploading(false);
    setRefreshToken((current) => current + 1);
    if (completed > 0) showToast("success", `อัปโหลดสำเร็จ ${completed} รูป`);
    if (duplicates > 0) showToast("error", `ข้ามรูปซ้ำ ${duplicates} รูป`);
    if (failed > 0) showToast("error", `อัปโหลดไม่สำเร็จ ${failed} รูป`);
    if (completed > 0 && flowActive) showGuide("upload-next");
  }

  const finishedCount = queue.filter((item) => ["COMPLETE", "DUPLICATE", "FAILED"].includes(item.status)).length;
  const completeCount = queue.filter((item) => item.status === "COMPLETE").length;
  const overallProgress = queue.length === 0 ? 0 : Math.round((finishedCount / queue.length) * 100);

  return (
    <>
      <ProjectPageHeader eyebrow="เฟส 2 · เพิ่มรูปภาพ" title="อัปโหลดรูปภาพ" description="เพิ่มไฟล์ JPG, PNG และ WebP ระบบจะตรวจสอบไฟล์ก่อนเก็บไว้ใน Server" />

      <section className="mt-6 rounded-xl border bg-white p-5 shadow-card sm:p-6">
        <div
          onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
          onDrop={(event) => { event.preventDefault(); setDragging(false); queueFiles(event.dataTransfer.files); }}
          className={`flex min-h-56 flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${dragging ? "border-primary bg-[#f1edfb]" : "border-line bg-gradient-to-br from-[#f5faff] to-[#f8f4fc]"}`}
        >
          <span className="grid size-12 place-items-center rounded-xl bg-[#eaf3ff] text-[#3f76b5]"><UploadCloud className="size-6 fill-[#3f76b5]/10" /></span>
          <h2 className="mt-4 text-base font-semibold text-ink">ลากรูปมาวางที่นี่</h2>
          <p className="mt-1 max-w-md text-sm leading-6 text-muted">หรือเลือกไฟล์จากคอมพิวเตอร์ รองรับ JPG, PNG และ WebP ไม่เกิน 25 MB ต่อรูป หรือไฟล์ ZIP ไม่เกิน 250 MB</p>
          <div className="relative mt-5 flex flex-wrap justify-center gap-2" onClickCapture={() => { if (activeGuide === "upload") completeGuide(); }}>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="action-highlight guide-action inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold"><ImagePlus className="size-4" />เลือกไฟล์</button>
            <button type="button" onClick={() => folderInputRef.current?.click()} className="guide-action inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-medium text-ink hover:bg-[#f6f3fb]"><FolderUp className="size-4" />เลือกโฟลเดอร์</button>
            <MobileUploadDialog projectId={projectId} />
            {activeGuide === "upload" ? <ToolGuidePopover title="เลือกวิธีเพิ่มรูปภาพ" description="กด “เลือกไฟล์” เพื่อเลือกรูปจากเครื่อง หรือกด “อัปโหลดจากมือถือ” หากรูปอยู่ในโทรศัพท์" onDismiss={dismissGuide} placement="below-left" /> : null}
          </div>
          <p className="mt-4 text-xs text-muted">ระบบตรวจไฟล์ซ้ำด้วย SHA‑256 และข้ามไฟล์ซ้ำให้อัตโนมัติ</p>
        </div>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/zip,.jpg,.jpeg,.png,.webp,.zip" multiple className="hidden" onChange={(event) => { if (event.target.files) queueFiles(event.target.files); event.target.value = ""; }} />
        <input ref={folderInputRef} type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple className="hidden" onChange={(event) => { if (event.target.files) queueFiles(event.target.files); event.target.value = ""; }} />
      </section>

      <UploadQueue
        queue={queue}
        uploading={uploading}
        overallProgress={overallProgress}
        completeCount={completeCount}
        showStartGuide={activeGuide === "upload-submit"}
        onGuideDismiss={dismissGuide}
        onGuideComplete={completeGuide}
        onStart={() => void startUpload()}
        onClear={() => setQueue((current) => current.filter((item) => item.status === "WAITING" || item.status === "UPLOADING"))}
        onRemove={(id) => setQueue((current) => current.filter((item) => item.id !== id))}
      />

      <ImageLibrary projectId={projectId} refreshToken={refreshToken} />

      {activeGuide === "upload-next" ? <NextStepPrompt title="เพิ่มรูปเรียบร้อย ไปสร้าง Class ต่อเลย" description="ขั้นถัดไปคือตั้งชื่อวัตถุที่ต้องการให้ AI มองหา แล้วจึงเริ่มตีกรอบ" href={`/projects/${projectId}/annotate?guide=class&tour=1`} actionLabel="ไปสร้าง Class" onDismiss={dismissGuide} /> : null}
    </>
  );
}

type UploadQueueProps = {
  queue: QueueItem[];
  uploading: boolean;
  overallProgress: number;
  completeCount: number;
  showStartGuide: boolean;
  onGuideDismiss: () => void;
  onGuideComplete: () => void;
  onStart: () => void;
  onClear: () => void;
  onRemove: (id: string) => void;
};

function UploadQueue({ queue, uploading, overallProgress, completeCount, showStartGuide, onGuideDismiss, onGuideComplete, onStart, onClear, onRemove }: UploadQueueProps) {
  if (queue.length === 0) return null;
  const waitingCount = queue.filter((item) => item.status === "WAITING" || item.status === "FAILED").length;

  return (
    <section className="mt-6 rounded-xl border bg-white shadow-card">
      <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink">คิวอัปโหลด</h2>
          <p className="mt-1 text-sm text-muted">เก็บแล้ว {completeCount} จาก {queue.length} ไฟล์ · ประมวลผล {overallProgress}%</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClear} disabled={uploading} className="h-9 rounded-lg border px-3 text-sm font-medium text-ink hover:bg-slate-50 disabled:opacity-50">ล้างรายการที่เสร็จแล้ว</button>
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                if (showStartGuide) onGuideComplete();
                onStart();
              }}
              disabled={uploading || waitingCount === 0}
              className="action-primary guide-action inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? <LoaderCircle className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
              {uploading ? "กำลังอัปโหลด" : `อัปโหลด ${waitingCount} ไฟล์`}
            </button>
            {showStartGuide ? (
              <ToolGuidePopover
                title="กดปุ่มนี้เพื่ออัปโหลดไฟล์"
                description={`เลือกรูปไว้ในคิวแล้ว ${waitingCount} ไฟล์ กดปุ่ม “อัปโหลด ${waitingCount} ไฟล์” เพื่อเริ่มส่งรูปเข้า Server จริง`}
                onDismiss={onGuideDismiss}
                placement="above-right"
                className="w-64"
              />
            ) : null}
          </div>
        </div>
      </div>
      <div className="mx-5 mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${overallProgress}%` }} /></div>
      <div className="max-h-80 overflow-auto p-2 sm:p-3">
        {queue.map((item) => <QueueRow key={item.id} item={item} onRemove={() => onRemove(item.id)} disabled={uploading} />)}
      </div>
    </section>
  );
}

function QueueRow({ item, onRemove, disabled }: { item: QueueItem; onRemove: () => void; disabled: boolean }) {
  const status = queueStatusPresentation[item.status];
  const Icon = status.icon;
  const maximumSize = item.file.name.toLowerCase().endsWith(".zip") ? MAX_ZIP_UPLOAD_BYTES : MAX_IMAGE_SIZE_BYTES;
  const invalidSize = item.file.size > maximumSize;

  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-slate-50">
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-slate-100 text-primary"><FileImage className="size-4" /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink" title={item.displayName}>{item.displayName}</p>
        <p className="mt-0.5 truncate text-xs text-muted">{formatByteSize(item.file.size)}{invalidSize ? ` · เกินขนาดจำกัด ${formatByteSize(maximumSize)}` : item.message ? ` · ${item.message}` : ""}</p>
      </div>
      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${status.className}`}><Icon className={`size-3.5 ${item.status === "UPLOADING" ? "animate-spin" : ""}`} />{status.label}</span>
      <button type="button" disabled={disabled || item.status === "UPLOADING"} onClick={onRemove} className="rounded p-1 text-muted hover:bg-slate-200 hover:text-danger disabled:opacity-40" aria-label={`นำ ${item.displayName} ออกจากคิว`}><Trash2 className="size-4" /></button>
    </div>
  );
}

const queueStatusPresentation = {
  WAITING: { label: "รออัปโหลด", className: "text-muted", icon: FileImage },
  UPLOADING: { label: "กำลังอัปโหลด", className: "text-primary", icon: LoaderCircle },
  COMPLETE: { label: "สำเร็จ", className: "text-success", icon: CheckCircle2 },
  DUPLICATE: { label: "ไฟล์ซ้ำ", className: "text-warning", icon: XCircle },
  FAILED: { label: "ไม่สำเร็จ", className: "text-danger", icon: XCircle },
} as const;
