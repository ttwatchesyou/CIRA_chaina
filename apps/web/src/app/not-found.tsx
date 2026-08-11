import { ArrowLeft, SearchX } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-5">
      <section className="max-w-md text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-white text-primary shadow-card"><SearchX className="size-6" /></span>
        <h1 className="mt-5 text-2xl font-semibold text-ink">ไม่พบโปรเจกต์</h1>
        <p className="mt-2 text-sm leading-6 text-muted">โปรเจกต์อาจถูกลบแล้ว หรือลิงก์นี้ไม่สามารถใช้งานได้</p>
        <Link href="/" className="action-primary guide-action mt-5 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium"><ArrowLeft className="size-4" />กลับไปหน้าโปรเจกต์</Link>
      </section>
    </main>
  );
}
