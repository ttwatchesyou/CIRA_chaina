import type { LucideIcon } from "lucide-react";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
};

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <section className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed bg-white px-6 py-12 text-center shadow-card">
      <span className="mb-4 grid size-12 place-items-center rounded-xl bg-slate-100 text-primary">
        <Icon className="size-6" aria-hidden />
      </span>
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}
