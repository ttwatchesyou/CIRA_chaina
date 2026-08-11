"use client";

import { RotateCcw } from "lucide-react";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-5">
      <section className="max-w-md rounded-xl border bg-white p-7 text-center shadow-card">
        <p className="text-sm font-semibold text-danger">เกิดข้อผิดพลาด</p>
        <h1 className="mt-2 text-xl font-semibold text-ink">ไม่สามารถเปิดพื้นที่ทำงานได้</h1>
        <p className="mt-2 text-sm leading-6 text-muted">กรุณาลองอีกครั้ง หากยังไม่สำเร็จให้ตรวจการเชื่อมต่อ Database และข้อความใน Server log</p>
        <button type="button" onClick={reset} className="action-primary guide-action mx-auto mt-5 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"><RotateCcw className="size-4" />ลองอีกครั้ง</button>
      </section>
    </main>
  );
}
