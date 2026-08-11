"use client";

import { LoaderCircle, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ApiFailure, ApiSuccess } from "@/lib/api";
import { useToast } from "@/components/ui/toast-provider";

type NewProjectDialogProps = {
  label?: string;
  compact?: boolean;
};

type ProjectCreationResult = { id: string; name: string };

export function NewProjectDialog({ label = "สร้างโปรเจกต์", compact = false }: NewProjectDialogProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function close() {
    if (submitting) return;
    setOpen(false);
    setFieldError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, type: "OBJECT_DETECTION" }),
      });
      const payload = (await response.json()) as ApiSuccess<ProjectCreationResult> | ApiFailure;

      if (!response.ok || !("data" in payload)) {
        const message = "error" in payload ? payload.error.issues?.name?.[0] ?? payload.error.message : "ไม่สามารถสร้างโปรเจกต์ได้";
        setFieldError(message);
        return;
      }

      showToast("success", `สร้าง “${payload.data.name}” แล้ว พร้อมเพิ่มรูปภาพได้เลย`);
      router.push(`/projects/${payload.data.id}`);
      router.refresh();
    } catch {
      setFieldError("เชื่อมต่อเครือข่ายไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`action-highlight guide-action inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors ${compact ? "size-9" : "h-10 px-4 text-sm"}`}
        aria-label={compact ? label : undefined}
      >
        <Plus className="size-4" aria-hidden />
        {compact ? null : label}
      </button>

      {open ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-labelledby="new-project-title">
          <div className="w-full max-w-lg rounded-xl border bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 id="new-project-title" className="text-base font-semibold text-ink">สร้างโปรเจกต์ใหม่</h2>
                <p className="mt-0.5 text-sm text-muted">เริ่มพื้นที่ทำงานสำหรับ Object Detection</p>
              </div>
              <button type="button" onClick={close} className="rounded-md p-1.5 text-muted hover:bg-slate-100 hover:text-ink" aria-label="ปิดหน้าต่าง">
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-5">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">ชื่อโปรเจกต์</span>
                <input
                  autoFocus
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="เช่น ตรวจจับขวดพลาสติก"
                  className="h-10 w-full rounded-lg border bg-white px-3 text-sm text-ink placeholder:text-slate-400"
                />
                {fieldError ? <span className="mt-1.5 block text-xs text-danger">{fieldError}</span> : null}
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">รายละเอียด <span className="font-normal text-muted">(ไม่บังคับ)</span></span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="ต้องการให้โมเดลตรวจจับอะไร?"
                  className="w-full resize-none rounded-lg border bg-white px-3 py-2.5 text-sm text-ink placeholder:text-slate-400"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">ประเภทโปรเจกต์</span>
                <select disabled value="OBJECT_DETECTION" className="h-10 w-full cursor-not-allowed rounded-lg border bg-slate-50 px-3 text-sm text-ink disabled:opacity-80">
                  <option value="OBJECT_DETECTION">Object Detection (ตรวจจับวัตถุ)</option>
                </select>
                <span className="mt-1.5 block text-xs text-muted">Classification และ Segmentation จะเพิ่มในเวอร์ชันถัดไป</span>
              </label>

              <div className="flex justify-end gap-2 border-t pt-4">
                <button type="button" onClick={close} className="h-10 rounded-lg border px-4 text-sm font-medium text-ink hover:bg-slate-50">ยกเลิก</button>
                <button disabled={submitting} type="submit" className="action-highlight guide-action inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:cursor-wait disabled:opacity-70">
                  {submitting ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  สร้างโปรเจกต์
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
