"use client";

import { AlertTriangle, LoaderCircle, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useToast } from "@/components/ui/toast-provider";

export function ProjectDeletePanel({ projectId, projectName }: { projectId: string; projectName: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const canDelete = confirmation === projectName && !deleting;

  async function deleteProject() {
    if (!canDelete) return;
    setDeleting(true);

    try {
      const response = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("ลบโปรเจกต์ไม่สำเร็จ");
      showToast("success", `ลบ “${projectName}” แล้ว`);
      router.push("/");
      router.refresh();
    } catch {
      showToast("error", "ไม่สามารถลบโปรเจกต์ได้ กรุณาลองอีกครั้ง");
      setDeleting(false);
    }
  }

  return (
    <section className="rounded-xl border border-danger/30 bg-white p-5 shadow-card">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#fbeeee] text-danger"><AlertTriangle className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-ink">พื้นที่อันตราย</h2>
          <p className="mt-1 text-sm leading-6 text-muted">การลบโปรเจกต์จะลบรูป Annotation, Dataset, โมเดล และประวัติกิจกรรมทั้งหมดอย่างถาวร</p>
          <button type="button" onClick={() => setOpen(true)} className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg border border-danger/40 px-3 text-sm font-medium text-danger hover:bg-[#fbeeee]"><Trash2 className="size-4" />ลบโปรเจกต์</button>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-project-title">
          <div className="w-full max-w-md rounded-xl border bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b px-5 py-4">
              <div>
                <h2 id="delete-project-title" className="text-base font-semibold text-ink">ลบ “{projectName}” หรือไม่?</h2>
                <p className="mt-1 text-sm text-muted">การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
              </div>
              <button type="button" disabled={deleting} onClick={() => setOpen(false)} className="rounded-md p-1.5 text-muted hover:bg-slate-100 hover:text-ink" aria-label="ปิดหน้าต่าง"><X className="size-4" /></button>
            </div>
            <div className="p-5">
              <p className="text-sm leading-6 text-ink">พิมพ์ <strong>{projectName}</strong> เพื่อยืนยันการลบถาวร</p>
              <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-3 h-10 w-full rounded-lg border px-3 text-sm text-ink" aria-label="ยืนยันชื่อโปรเจกต์" />
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" disabled={deleting} onClick={() => setOpen(false)} className="h-10 rounded-lg border px-4 text-sm font-medium text-ink hover:bg-slate-50">ยกเลิก</button>
                <button type="button" disabled={!canDelete} onClick={deleteProject} className="inline-flex h-10 items-center gap-2 rounded-lg bg-danger px-4 text-sm font-medium text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50">{deleting ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}ลบโปรเจกต์</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
