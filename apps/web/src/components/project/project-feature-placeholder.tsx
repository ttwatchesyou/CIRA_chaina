"use client";

import { Clock3, Layers3, Sparkles } from "lucide-react";

import { ProjectPageHeader } from "@/components/layout/project-page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ToolGuidePopover } from "@/components/ui/tool-guide-popover";
import { useStepGuide } from "@/lib/use-step-guide";

type ProjectFeaturePlaceholderProps = {
  title: string;
  description: string;
  phase: string;
  icon: "sparkles" | "layers";
  guideKey?: string;
};

export function ProjectFeaturePlaceholder({ title, description, phase, icon, guideKey }: ProjectFeaturePlaceholderProps) {
  const { activeGuide, dismissGuide, completeGuide } = useStepGuide();
  const showGuide = Boolean(guideKey && activeGuide === guideKey);
  const Icon = icon === "sparkles" ? Sparkles : Layers3;

  return (
    <>
      <ProjectPageHeader eyebrow={phase} title={title} description={description} />
      <div className="mt-6">
        <EmptyState icon={Icon} title={`กำลังเตรียมระบบ ${title}`} description={`หน้านี้เตรียมเส้นทางไว้แล้ว ระบบการทำงานเต็มรูปแบบจะเพิ่มใน ${phase}`} action={<div className="relative"><button type="button" onClick={() => { if (showGuide) completeGuide(); }} className="guide-action inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm text-muted"><Clock3 className="size-4" />พบกันใน {phase}</button>{showGuide ? <ToolGuidePopover title={`ระบบ ${title} กำลังเตรียมอยู่`} description="ตอนนี้ยังไม่มีเครื่องมือให้กด สามารถดาวน์โหลด Dataset ZIP ไป Train ภายนอกได้ก่อน" onDismiss={dismissGuide} placement="below-left" /> : null}</div>} />
      </div>
    </>
  );
}
