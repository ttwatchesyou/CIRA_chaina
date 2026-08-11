"use client";

import {
  Activity,
  ArrowRight,
  BrainCircuit,
  Boxes,
  Check,
  CheckCircle2,
  Database,
  ImageIcon,
  Layers3,
  MousePointerClick,
  ScanSearch,
  Sparkles,
  Tags,
  UploadCloud,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ProjectPageHeader } from "@/components/layout/project-page-header";
import { formatRelativeTime } from "@/lib/format";
import type { ProjectOverview } from "@/types/project";

export function ProjectOverviewPanel({ project }: { project: ProjectOverview }) {
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null);
  const totalImages = project.counts.images;
  const allImagesAnnotated = totalImages > 0 && project.counts.annotatedImages === totalImages;
  const workflowSteps = [
    {
      title: "เพิ่มรูปภาพ",
      description: "เลือกรูปที่ต้องการให้ AI เรียนรู้ จะอัปโหลดจากคอมหรือมือถือก็ได้",
      href: `/projects/${project.id}/upload`,
      guide: "upload",
      action: "ไปเพิ่มรูป",
      summary: totalImages > 0 ? `มีแล้ว ${totalImages} รูป` : "ยังไม่มีรูป",
      complete: totalImages > 0,
      icon: UploadCloud,
    },
    {
      title: "สร้าง Class",
      description: "ตั้งชื่อสิ่งที่ต้องการให้ AI มองหา เช่น คน รถ ขวด หรือสินค้า",
      href: `/projects/${project.id}/annotate`,
      guide: "class",
      action: "ไปสร้าง Class",
      summary: project.counts.classes > 0 ? `มีแล้ว ${project.counts.classes} Class` : "ยังไม่มี Class",
      complete: project.counts.classes > 0,
      icon: Tags,
    },
    {
      title: "ตีกรอบวัตถุ",
      description: "ลากกรอบให้พอดีกับวัตถุในแต่ละรูป แล้วเลือก Class ให้ถูกต้อง",
      href: `/projects/${project.id}/annotate`,
      guide: "box",
      action: "ไปทำ Annotation",
      summary: `${project.counts.annotatedImages} / ${totalImages} รูป`,
      complete: allImagesAnnotated,
      icon: ScanSearch,
    },
    {
      title: "สร้าง Dataset",
      description: "รวมรูปและกรอบที่ทำเสร็จแล้วเป็นชุดข้อมูลสำหรับนำไป Train",
      href: `/projects/${project.id}/dataset`,
      guide: "dataset",
      action: "ไปสร้าง Dataset",
      summary: project.counts.datasets > 0 ? `มีแล้ว ${project.counts.datasets} เวอร์ชัน` : "ยังไม่มี Dataset",
      complete: project.counts.datasets > 0,
      icon: Database,
    },
    {
      title: "สั่ง Train โมเดล",
      description: "เลือก Dataset ที่พร้อมใช้ แล้วส่งงานไปให้เครื่อง Train โมเดล",
      href: `/projects/${project.id}/training`,
      guide: "train",
      action: "ไปหน้า Train",
      summary: project.counts.jobs > 0 ? `ส่งแล้ว ${project.counts.jobs} งาน` : "ยังไม่มีงาน Train",
      complete: project.counts.jobs > 0,
      icon: Layers3,
    },
    {
      title: "ดาวน์โหลดโมเดล",
      description: "ดูค่า Metrics และดาวน์โหลด best checkpoint หรือรายงานผลจากงานที่ Train สำเร็จ",
      href: `/projects/${project.id}/models`,
      guide: "models",
      action: "ไปหน้าโมเดล",
      summary: project.counts.models > 0 ? `มีแล้ว ${project.counts.models} โมเดล` : "ยังไม่มีโมเดล",
      complete: project.counts.models > 0,
      icon: BrainCircuit,
    },
  ];
  const currentStepIndex = workflowSteps.findIndex((step) => !step.complete);
  const selectedStep = selectedStepIndex === null ? null : workflowSteps[selectedStepIndex];
  const selectedStepIsCurrent = selectedStepIndex !== null && selectedStepIndex === currentStepIndex;
  const selectedDestination = selectedStep
    ? `${selectedStep.href}?guide=${selectedStep.guide}&tour=1`
    : "#";
  const SelectedStepIcon = selectedStep?.icon ?? Sparkles;
  const metrics = [
    { label: "รูปภาพทั้งหมด", value: totalImages, icon: ImageIcon },
    { label: "ทำ Annotation แล้ว", value: project.counts.annotatedImages, icon: CheckCircle2 },
    { label: "คลาส", value: project.counts.classes, icon: Boxes },
    { label: "เวอร์ชัน Dataset", value: project.counts.datasets, icon: Database },
    { label: "งาน Train", value: project.counts.jobs, icon: Layers3 },
  ];

  return (
    <>
      <ProjectPageHeader eyebrow="ภาพรวมโปรเจกต์" title={project.name} description={project.description || "ทำตามขั้นตอนด้านล่างเพื่อสร้าง Dataset และ Train โมเดลได้ง่าย ๆ"} />

      <section className="mt-6" aria-labelledby="workflow-title">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="workflow-title" className="text-lg font-semibold text-ink">ทำตามทีละขั้นตอน</h2>
            <p className="mt-1 text-sm text-muted">คลิกการ์ดเพื่ออ่านคำอธิบายก่อนเข้าไปทำ ขั้นสีเหลืองคือขั้นที่ควรทำตอนนี้</p>
          </div>
          <span className="guide-action inline-flex items-center gap-2 text-xs font-medium text-primary"><MousePointerClick className="size-4" />คลิกได้ทั้งการ์ด</span>
        </div>
        <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {workflowSteps.map((step, index) => {
            const isCurrent = index === currentStepIndex;
            const Icon = step.icon;
            return (
              <li key={step.title}>
                <button
                  type="button"
                  onClick={() => setSelectedStepIndex(index)}
                  className={`group relative flex min-h-[280px] w-full flex-col overflow-hidden rounded-2xl bg-white p-5 text-left shadow-card transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(65,51,102,0.14)] focus-visible:-translate-y-1 ${step.complete ? "border border-[#a8d2b6]" : isCurrent ? "border border-[#dfbd58] ring-2 ring-[#f6df94]/45" : "border"}`}
                >
                  <span aria-hidden className={`pointer-events-none absolute -right-10 -top-10 size-28 rounded-full transition-transform duration-300 group-hover:scale-125 ${step.complete ? "bg-[#eef8f1]" : isCurrent ? "bg-[#fff4c9]" : "bg-[#f0f5fc]"}`} />
                  <div className="relative flex items-center justify-between gap-3">
                    <span className={`grid size-10 place-items-center rounded-full text-sm font-bold ${step.complete ? "bg-[#e1f2e7] text-success" : isCurrent ? "bg-[#ffe9a1] text-[#765817]" : "bg-[#eaf3ff] text-[#3f76b5]"}`}>
                      {step.complete ? <Check className="size-4" /> : index + 1}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${step.complete ? "bg-[#e8f5ec] text-success" : isCurrent ? "bg-[#fff1bd] text-[#80601b]" : "bg-slate-100 text-muted"}`}>
                      {step.complete ? "เสร็จแล้ว" : isCurrent ? "ทำขั้นนี้ต่อ" : "รอก่อน"}
                    </span>
                  </div>
                  <span className={`relative mt-7 grid size-14 place-items-center rounded-2xl transition-transform duration-200 group-hover:scale-105 ${step.complete ? "bg-[#e8f5ec] text-success" : isCurrent ? "bg-[#fff0b8] text-[#3f76b5]" : "bg-[#eaf3ff] text-[#3f76b5]"}`}><Icon className="size-7 fill-current/10" /></span>
                  <h3 className="relative mt-4 text-base font-semibold text-ink">ขั้นที่ {index + 1} · {step.title}</h3>
                  <p className="relative mt-2 text-sm leading-6 text-muted">{step.description}</p>
                  <div className="relative mt-auto flex items-end justify-between gap-3 border-t pt-4">
                    <span className={`text-sm font-semibold ${step.complete ? "text-success" : isCurrent ? "text-[#80601b]" : "text-muted"}`}>{step.summary}</span>
                    <span className="guide-action inline-flex items-center gap-1.5 text-xs font-semibold text-primary">ดูขั้นตอน<ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></span>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)]">
        <div>
          <div className="mb-4">
            <h2 className="text-base font-semibold text-ink">ตัวเลขสรุป</h2>
            <p className="mt-1 text-sm text-muted">ดูจำนวนงานทั้งหมดในโปรเจกต์นี้แบบรวดเร็ว</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {metrics.map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center gap-3 rounded-xl border bg-white p-4 shadow-card">
                <span className="grid size-9 place-items-center rounded-lg bg-[#eaf3ff] text-[#3f76b5]"><Icon className="size-4 fill-[#3f76b5]/10" /></span>
                <div><p className="text-xs text-muted">{label}</p><p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{value}</p></div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-card xl:mt-14">
          <div className="flex items-center gap-2"><Activity className="size-4 text-[#3f76b5]" /><h2 className="text-base font-semibold text-ink">กิจกรรมล่าสุด</h2></div>
          {project.activities.length === 0 ? (
            <p className="mt-5 text-sm leading-6 text-muted">ประวัติการอัปโหลดรูป สร้าง Dataset และ Train โมเดลจะแสดงที่นี่</p>
          ) : (
            <ol className="mt-4 divide-y">
              {project.activities.map((activity) => (
                <li key={activity.id} className="py-3 first:pt-0 last:pb-0">
                  <p className="text-sm text-ink">{activityMessage(activity.type, activity.message)}</p>
                  <p className="mt-1 text-xs text-muted">{formatRelativeTime(activity.createdAt)}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      {selectedStep ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="step-confirm-title" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelectedStepIndex(null); }}>
          <section className="w-full max-w-md rounded-2xl bg-gradient-to-br from-[#6f9ed1] via-[#7869b3] to-[#9b74b8] p-px shadow-2xl">
            <div className="relative rounded-[15px] bg-white p-6">
              <button type="button" onClick={() => setSelectedStepIndex(null)} className="absolute right-3 top-3 grid size-8 place-items-center rounded-lg text-muted hover:bg-slate-100 hover:text-ink" aria-label="ปิดหน้าต่าง"><X className="size-4" /></button>
              <span className={`grid size-12 place-items-center rounded-2xl ${selectedStep.complete ? "bg-[#e8f5ec] text-success" : selectedStepIsCurrent ? "bg-[#fff0b8] text-[#3f76b5]" : "bg-[#eaf3ff] text-[#3f76b5]"}`}><SelectedStepIcon className="size-6 fill-current/10" /></span>
              <p className={`mt-4 text-xs font-semibold ${selectedStep.complete ? "text-success" : selectedStepIsCurrent ? "text-[#80601b]" : "text-primary"}`}>
                ขั้นที่ {(selectedStepIndex ?? 0) + 1} · {selectedStep.complete ? "เคยทำขั้นนี้แล้ว" : selectedStepIsCurrent ? "ขั้นที่แนะนำตอนนี้" : "ขั้นถัดไป"}
              </p>
              <h2 id="step-confirm-title" className="mt-1 text-xl font-semibold text-ink">กำลังจะไป{selectedStep.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{selectedStep.description}</p>
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-[#f6f3fb] p-3 text-xs leading-5 text-ink"><Sparkles className="mt-0.5 size-4 shrink-0 text-primary" /><span>เข้าไปแล้วระบบจะแนะนำเครื่องมือที่ต้องใช้ให้ทีละจุด</span></div>
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setSelectedStepIndex(null)} className="h-10 rounded-lg border bg-white px-4 text-sm font-semibold text-ink hover:bg-slate-50">ยกเลิก</button>
                <Link href={selectedDestination} onClick={() => setSelectedStepIndex(null)} className="action-highlight guide-action inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold">ยืนยันและเข้าไป<ArrowRight className="size-4" /></Link>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function activityMessage(type: string, fallback: string) {
  const messages: Record<string, string> = {
    PROJECT_CREATED: "สร้างโปรเจกต์แล้ว",
    IMAGES_UPLOADED: "อัปโหลดรูปภาพเข้ามาแล้ว",
    IMAGE_ANNOTATED: "บันทึก Annotation ของรูปแล้ว",
    IMAGE_DELETED: "ลบรูปภาพแล้ว",
    CLASS_CREATED: "สร้างคลาสใหม่แล้ว",
    CLASS_DELETED: "ลบคลาสแล้ว",
    DATASET_CREATED: "สร้างเวอร์ชัน Dataset แล้ว",
    DATASET_DELETED: "ลบเวอร์ชัน Dataset แล้ว",
    MOBILE_UPLOAD_LINK_CREATED: "สร้าง QR Code สำหรับอัปโหลดจากมือถือแล้ว",
  };
  return messages[type] ?? fallback;
}
