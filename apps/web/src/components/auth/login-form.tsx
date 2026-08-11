"use client";

import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, UserRound } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import type { ApiFailure, ApiSuccess } from "@/lib/api";
import type { AuthUser } from "@/types/auth";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const payload = (await response.json()) as ApiSuccess<{ user: AuthUser }> | ApiFailure;
      if (!response.ok || !("data" in payload)) {
        setError("error" in payload ? payload.error.message : "ไม่สามารถเข้าสู่ระบบได้");
        return;
      }

      const destination = searchParams.get("next");
      router.push(destination?.startsWith("/") ? destination : "/");
      router.refresh();
    } catch {
      setError("เชื่อมต่อเครือข่ายไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative grid min-h-screen overflow-hidden bg-[#f5f2fb] px-5 py-8 lg:grid-cols-2 lg:p-0">
      <div className="pointer-events-none absolute -left-28 top-0 size-96 rounded-full bg-[#d4e4f3]/70 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 size-80 rounded-full bg-[#ded4ef]/70 blur-3xl" />

      <section className="relative mx-auto flex w-full max-w-md flex-col justify-center py-6 lg:mx-0 lg:max-w-none lg:px-[max(3rem,10vw)] lg:py-16">
        <div className="mb-9 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-navy text-white shadow-card"><LockKeyhole className="size-5" /></span>
          <div><p className="text-sm font-semibold text-ink">Internal Vision Platform</p><p className="text-xs text-muted">พื้นที่ทำงาน Computer Vision</p></div>
        </div>
        <div className="rounded-2xl border bg-white p-6 shadow-[0_18px_60px_rgba(24,36,51,0.10)] sm:p-8">
          <p className="text-xs font-semibold tracking-[0.08em] text-primary">ยินดีต้อนรับกลับ</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">เข้าสู่พื้นที่ทำงานของคุณ</h1>
          <p className="mt-2 text-sm leading-6 text-muted">โปรเจกต์ รูปภาพ และ Dataset จะแยกเก็บตาม Account</p>

          <form onSubmit={login} className="mt-7 space-y-4">
            <label className="block"><span className="mb-1.5 block text-sm font-medium text-ink">ชื่อผู้ใช้</span><span className="relative block"><UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary" /><input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required className="h-11 w-full rounded-lg border bg-white pl-9 pr-3 text-sm text-ink" placeholder="ใส่ชื่อผู้ใช้" /></span></label>
            <label className="block"><span className="mb-1.5 block text-sm font-medium text-ink">รหัสผ่าน</span><span className="relative block"><LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary" /><input autoComplete="current-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} required className="h-11 w-full rounded-lg border bg-white pl-9 pr-10 text-sm text-ink" placeholder="ใส่รหัสผ่าน" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-primary hover:bg-slate-100" aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></span></label>
            {error ? <p role="alert" className="rounded-lg border border-danger/30 bg-[#fbeeee] px-3 py-2.5 text-sm text-danger">{error}</p> : null}
            <button disabled={loading} type="submit" className="action-primary guide-action inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:cursor-wait disabled:opacity-60">{loading ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}{loading ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}</button>
          </form>
        </div>
        <p className="mt-5 text-center text-xs text-muted">สำหรับใช้งานภายใน · Session ใน Browser มีอายุ 7 วัน</p>
      </section>

      <section className="relative hidden overflow-hidden bg-navy p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(89,122,150,0.48),transparent_30%),radial-gradient(circle_at_15%_85%,rgba(59,87,111,0.5),transparent_33%)]" />
        <div className="relative"><span className="inline-flex items-center gap-2 rounded-full border border-slate-500/50 bg-slate-700/30 px-3 py-1.5 text-xs font-medium text-slate-200"><span className="size-1.5 rounded-full bg-[#d9bd70]" />พื้นที่ทำงานส่วนตัว</span></div>
        <div className="relative max-w-lg"><p className="text-sm font-medium tracking-[0.12em] text-[#cbdcf0]">จัดการ Dataset ครบในที่เดียว</p><h2 className="mt-4 text-4xl font-semibold leading-tight tracking-tight">พื้นที่ที่ออกแบบมาเพื่อทุกโปรเจกต์ Vision</h2><p className="mt-5 max-w-md text-base leading-7 text-slate-300">แต่ละ Account จะเห็นเฉพาะโปรเจกต์ รูป Annotation, Dataset และผลการ Train ของตัวเอง</p></div>
        <div className="relative flex gap-8 border-t border-slate-600/60 pt-6 text-sm text-slate-300"><span>Session ปลอดภัย</span><span>แยกพื้นที่เก็บข้อมูล</span><span>Workflow ภายใน</span></div>
      </section>
    </main>
  );
}
