"use client";

import { Check, Copy, LoaderCircle, QrCode, ShieldCheck, Smartphone, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { useToast } from "@/components/ui/toast-provider";
import type { ApiFailure, ApiSuccess } from "@/lib/api";
import type { MobileUploadLink } from "@/types/mobile-upload";

export function MobileUploadDialog({ projectId }: { projectId: string }) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<MobileUploadLink | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createLink() {
    setCreating(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/mobile-upload-links`, { method: "POST" });
      const payload = (await response.json()) as ApiSuccess<MobileUploadLink> | ApiFailure;
      if (!response.ok || !("data" in payload)) throw new Error("error" in payload ? payload.error.message : "ไม่สามารถสร้างลิงก์มือถือได้");

      const QRCode = (await import("qrcode")).default;
      const dataUrl = await QRCode.toDataURL(payload.data.url, {
        width: 256,
        margin: 1,
        color: { dark: "#33264E", light: "#FFFFFF" },
      });
      setLink(payload.data);
      setQrDataUrl(dataUrl);
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : "ไม่สามารถสร้างลิงก์อัปโหลดจากมือถือได้");
    } finally {
      setCreating(false);
    }
  }

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      showToast("success", "คัดลอกลิงก์สำหรับมือถือแล้ว");
    } catch {
      showToast("error", "คัดลอกลิงก์ไม่สำเร็จ กรุณาคัดลอกด้วยตนเอง");
    }
  }

  async function revokeLink() {
    if (!link) return;
    setRevoking(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/mobile-upload-links/${link.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("ยกเลิกลิงก์ไม่สำเร็จ");
      setLink(null);
      setQrDataUrl(null);
      showToast("success", "ยกเลิกลิงก์มือถือแล้ว");
    } catch {
      showToast("error", "ไม่สามารถยกเลิกลิงก์มือถือได้");
    } finally {
      setRevoking(false);
    }
  }

  function close() {
    if (creating || revoking) return;
    setOpen(false);
  }

  const localOnly = link ? isLocalAddress(link.url) : false;

  return (
    <>
      <button type="button" onClick={() => { setOpen(true); if (!link) void createLink(); }} className="guide-action inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-medium text-ink hover:bg-[#f6f3fb]"><QrCode className="size-4" />อัปโหลดจากมือถือ</button>

      {open ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-labelledby="mobile-upload-title">
          <div className="w-full max-w-md overflow-hidden rounded-xl border bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b px-5 py-4">
              <div>
                <div className="flex items-center gap-2 text-primary"><Smartphone className="size-4" /><span className="text-xs font-semibold tracking-[0.08em]">อัปโหลดผ่านมือถือ</span></div>
                <h2 id="mobile-upload-title" className="mt-1 text-base font-semibold text-ink">สแกน QR Code เพื่อเพิ่มรูป</h2>
              </div>
              <button type="button" onClick={close} disabled={creating || revoking} className="rounded-md p-1.5 text-muted hover:bg-slate-100 hover:text-ink" aria-label="ปิดหน้าต่าง"><X className="size-4" /></button>
            </div>

            <div className="p-5">
              {creating ? <div className="grid min-h-64 place-items-center"><div className="text-center"><LoaderCircle className="mx-auto size-6 animate-spin text-primary" /><p className="mt-3 text-sm text-muted">กำลังสร้างลิงก์ที่ปลอดภัย…</p></div></div> : null}
              {error ? <div className="rounded-lg border border-danger/30 bg-[#fbeeee] p-3 text-sm text-danger">{error}<button type="button" onClick={() => void createLink()} className="ml-2 font-semibold underline">ลองอีกครั้ง</button></div> : null}
              {link && qrDataUrl ? (
                <>
                  <div className="mx-auto grid w-fit place-items-center rounded-xl border bg-white p-3 shadow-card"><Image src={qrDataUrl} alt="QR Code สำหรับอัปโหลดรูปจากมือถือ" width={224} height={224} unoptimized /></div>
                  <p className="mt-4 text-center text-sm leading-6 text-muted">เปิดกล้องมือถือ สแกน QR Code แล้วเลือกหรือถ่ายรูปที่ต้องการอัปโหลด</p>
                  {localOnly ? <p className="mt-3 rounded-lg border border-warning/40 bg-[#fbf6e8] p-3 text-xs leading-5 text-[#80672f]">QR นี้ชี้ไปที่ localhost ซึ่งมือถือเปิดไม่ได้ กรุณาตั้งค่า <code>PUBLIC_APP_URL</code> ใน <code>.env</code> เป็น LAN IP หรือ Tailscale URL ของคอม แล้วเปิด Server ใหม่</p> : null}
                  <div className="mt-4 flex gap-2">
                    <input value={link.url} readOnly aria-label="ลิงก์อัปโหลดจากมือถือ" className="h-10 min-w-0 flex-1 rounded-lg border bg-slate-50 px-3 text-xs text-ink" />
                    <button type="button" onClick={() => void copyLink()} className="guide-action grid size-10 shrink-0 place-items-center rounded-lg border text-primary hover:bg-slate-50" aria-label="คัดลอกลิงก์มือถือ"><Copy className="size-4" /></button>
                  </div>
                  <div className="mt-4 flex items-start gap-2 rounded-lg bg-[#eef5f0] p-3 text-xs leading-5 text-success"><ShieldCheck className="mt-0.5 size-4 shrink-0" /><span>ลิงก์นี้อัปโหลดได้เฉพาะโปรเจกต์นี้ และหมดอายุเวลา {new Date(link.expiresAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} หากสร้าง QR ใหม่ ลิงก์เดิมจะถูกยกเลิกอัตโนมัติ</span></div>
                  <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => void revokeLink()} disabled={revoking} className="h-9 rounded-lg border border-danger/40 px-3 text-sm font-medium text-danger hover:bg-[#fbeeee] disabled:opacity-50">{revoking ? "กำลังยกเลิก…" : "ยกเลิกลิงก์"}</button><button type="button" onClick={close} className="action-primary guide-action inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium"><Check className="size-4" />เสร็จสิ้น</button></div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function isLocalAddress(url: string) {
  try {
    const hostname = new URL(url).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return true;
  }
}
