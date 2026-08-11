import type { ReactNode } from "react";

type ProjectPageHeaderProps = {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
};

export function ProjectPageHeader({ eyebrow, title, description, action }: ProjectPageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-[#ddd6eb] pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">{eyebrow}</p> : null}
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
        <p className="mt-1.5 text-sm text-muted">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
