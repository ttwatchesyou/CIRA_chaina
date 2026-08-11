"use client";

import { X } from "lucide-react";

type ToolGuidePopoverProps = {
  title: string;
  description: string;
  onDismiss: () => void;
  placement?: "below-left" | "below-right" | "above-left" | "above-right";
  className?: string;
};

const placementClasses = {
  "below-left": "left-0 top-full mt-3",
  "below-right": "right-0 top-full mt-3",
  "above-left": "bottom-full left-0 mb-3",
  "above-right": "bottom-full right-0 mb-3",
};

export function ToolGuidePopover({
  title,
  description,
  onDismiss,
  placement = "below-left",
  className = "w-72",
}: ToolGuidePopoverProps) {
  const below = placement.startsWith("below");
  const right = placement.endsWith("right");

  return (
    <div
      role="dialog"
      aria-label={title}
      className={`absolute z-50 rounded-xl bg-gradient-to-br from-[#6f9ed1] via-[#7869b3] to-[#9b74b8] p-px shadow-[0_16px_36px_rgba(56,43,91,0.22)] ${placementClasses[placement]} ${className}`}
    >
      <span
        aria-hidden
        className={`absolute size-3 rotate-45 bg-white ${below ? "-top-1.5 border-l border-t border-[#7b72b8]" : "-bottom-1.5 border-b border-r border-[#7b72b8]"} ${right ? "right-5" : "left-5"}`}
      />
      <div className="relative rounded-[11px] bg-white p-3.5 pr-10 text-left">
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-2.5 top-2.5 grid size-7 place-items-center rounded-md text-muted hover:bg-slate-100 hover:text-ink"
          aria-label="ปิดคำแนะนำ"
        >
          <X className="size-4" />
        </button>
        <p className="text-xs font-semibold text-primary">เริ่มตรงนี้</p>
        <p className="mt-1 text-sm font-semibold text-ink">{title}</p>
        <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
      </div>
    </div>
  );
}
