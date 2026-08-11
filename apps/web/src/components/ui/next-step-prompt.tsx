"use client";

import { ArrowRight, CheckCircle2, X } from "lucide-react";
import Link from "next/link";

type NextStepPromptProps = {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  onDismiss: () => void;
};

export function NextStepPrompt({ title, description, href, actionLabel, onDismiss }: NextStepPromptProps) {
  return (
    <aside role="dialog" aria-label={title} className="fixed bottom-4 right-4 z-[70] w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-gradient-to-br from-[#6f9ed1] via-[#7869b3] to-[#9b74b8] p-px shadow-[0_20px_50px_rgba(45,34,75,0.28)] sm:bottom-6 sm:right-6">
      <div className="relative rounded-[15px] bg-white p-5">
        <button type="button" onClick={onDismiss} className="absolute right-3 top-3 grid size-8 place-items-center rounded-lg text-muted hover:bg-slate-100 hover:text-ink" aria-label="ปิดคำแนะนำต่อเนื่อง"><X className="size-4" /></button>
        <span className="grid size-10 place-items-center rounded-xl bg-[#e5f4ea] text-success"><CheckCircle2 className="size-5" /></span>
        <p className="mt-3 text-xs font-semibold text-success">ขั้นนี้เสร็จแล้ว</p>
        <h2 className="mt-1 text-base font-semibold text-ink">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
        <Link href={href} className="action-highlight guide-action mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold">
          {actionLabel}<ArrowRight className="size-4" />
        </Link>
      </div>
    </aside>
  );
}
