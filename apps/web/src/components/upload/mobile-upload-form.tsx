"use client";

import { Camera, CheckCircle2, CircleAlert, FolderOpen, LoaderCircle, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { formatByteSize } from "@/lib/image-validation";
import type { ApiFailure, ApiSuccess } from "@/lib/api";
import type { UploadImagesResult } from "@/types/image";
import type { MobileUploadAccess } from "@/types/mobile-upload";

type MobileUploadFormProps = {
  token: string;
};

export function MobileUploadForm({ token }: MobileUploadFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [access, setAccess] = useState<MobileUploadAccess | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/mobile-upload/${token}`, { cache: "no-store" });
        const payload = (await response.json()) as ApiSuccess<MobileUploadAccess> | ApiFailure;
        if (!response.ok || !("data" in payload)) throw new Error("error" in payload ? payload.error.message : "ไม่สามารถตรวจสอบลิงก์นี้ได้");
        if (active) setAccess(payload.data);
      } catch (accessError) {
        if (active) setError(accessError instanceof Error ? accessError.message : "ไม่สามารถตรวจสอบลิงก์นี้ได้");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [token]);

  async function upload() {
    if (files.length === 0 || uploading) return;
    setUploading(true);
    setError(null);
    setMessage(null);
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file, file.name));

    try {
      const response = await fetch(`/api/mobile-upload/${token}/images`, { method: "POST", body: formData });
      const payload = (await response.json()) as ApiSuccess<UploadImagesResult> | ApiFailure;
      if (!response.ok || !("data" in payload)) throw new Error("error" in payload ? payload.error.message : "ไม่สามารถอัปโหลดรูปได้");
      setMessage(`สำเร็จ ${payload.data.completed} · ซ้ำ ${payload.data.duplicates} · ไม่สำเร็จ ${payload.data.failed}`);
      if (payload.data.completed > 0) setFiles([]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "ไม่สามารถอัปโหลดรูปได้");
    } finally {
      setUploading(false);
    }
  }

  function selectFiles(selectedFiles: FileList | null) {
    if (!access || !selectedFiles) return;
    setFiles(Array.from(selectedFiles).slice(0, access.maxFiles));
    setMessage(null);
    setError(null);
  }

  if (loading) return <MobileShell><div className="grid min-h-64 place-items-center"><LoaderCircle className="size-6 animate-spin text-primary" /></div></MobileShell>;
  if (!access) return <MobileShell><StatusCard error title="ลิงก์อัปโหลดนี้ใช้ไม่ได้" description={error || "ลิงก์อาจหมดอายุหรือถูกยกเลิก กรุณาสร้าง QR Code ใหม่จากหน้าโปรเจกต์"} /></MobileShell>;

  return (
    <MobileShell>
      <header>
        <p className="text-xs font-semibold tracking-[0.1em] text-primary">แพลตฟอร์ม Computer Vision</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">อัปโหลดรูปภาพ</h1>
        <p className="mt-2 text-sm leading-6 text-muted">กำลังเพิ่มรูปไปที่ <span className="font-semibold text-ink">{access.projectName}</span></p>
      </header>

      <section className="mt-7 rounded-xl border bg-white p-5 shadow-card">
        <span className="grid size-10 place-items-center rounded-lg bg-[#eaf3ff] text-[#3f76b5]"><Camera className="size-5 fill-[#3f76b5]/10" /></span>
        <h2 className="mt-4 text-base font-semibold text-ink">เพิ่มรูปจากมือถือ</h2>
        <p className="mt-1 text-sm leading-6 text-muted">รองรับ JPG, PNG หรือ WebP ขนาดไม่เกิน {formatByteSize(access.maxImageSizeBytes)} ต่อรูป และไม่เกิน {access.maxFiles} รูปต่อครั้ง</p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => inputRef.current?.click()} className="action-highlight guide-action inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold"><FolderOpen className="size-4" />เลือกไฟล์</button>
          <button type="button" onClick={() => cameraInputRef.current?.click()} className="guide-action inline-flex h-11 items-center justify-center gap-2 rounded-lg border bg-white px-4 text-sm font-medium text-ink hover:bg-slate-50"><Camera className="size-4" />ถ่ายรูป</button>
        </div>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple className="hidden" onChange={(event) => { selectFiles(event.target.files); event.target.value = ""; }} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { selectFiles(event.target.files); event.target.value = ""; }} />
      </section>

      {files.length > 0 ? <section className="mt-4 rounded-xl border bg-white p-4 shadow-card"><div className="flex justify-between gap-4"><h2 className="text-sm font-semibold text-ink">พร้อมอัปโหลด</h2><span className="text-sm text-muted">เลือกแล้ว {files.length} รูป</span></div><ul className="mt-3 max-h-40 divide-y overflow-auto">{files.map((file) => <li key={`${file.name}-${file.lastModified}`} className="flex justify-between gap-3 py-2 text-sm"><span className="truncate text-ink">{file.name}</span><span className="shrink-0 text-muted">{formatByteSize(file.size)}</span></li>)}</ul><button type="button" disabled={uploading} onClick={() => void upload()} className="action-primary guide-action mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium disabled:opacity-60">{uploading ? <LoaderCircle className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}{uploading ? "กำลังอัปโหลด…" : "อัปโหลดรูป"}</button></section> : null}
      {message ? <StatusCard title="อัปโหลดเสร็จแล้ว" description={message} /> : null}
      {error ? <StatusCard error title="อัปโหลดไม่สำเร็จ" description={error} /> : null}
      <p className="mt-6 text-center text-xs leading-5 text-muted">ลิงก์นี้หมดอายุเวลา {new Date(access.expiresAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</p>
    </MobileShell>
  );
}

function MobileShell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto min-h-screen max-w-lg bg-canvas px-5 py-8 sm:px-7">{children}</main>;
}

function StatusCard({ title, description, error = false }: { title: string; description: string; error?: boolean }) {
  const Icon = error ? CircleAlert : CheckCircle2;
  return <section className={`mt-4 rounded-xl border p-4 ${error ? "border-danger/30 bg-[#fbeeee]" : "border-success/30 bg-[#eef5f0]"}`}><div className={`flex items-start gap-2 ${error ? "text-danger" : "text-success"}`}><Icon className="mt-0.5 size-4 shrink-0" /><div><h2 className="text-sm font-semibold">{title}</h2><p className="mt-1 text-sm leading-5 text-ink">{description}</p></div></div></section>;
}
