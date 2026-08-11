"use client";

import dynamic from "next/dynamic";

const AnnotationWorkspace = dynamic(
  () => import("@/components/annotation/annotation-workspace").then((module) => module.AnnotationWorkspace),
  {
    ssr: false,
    loading: () => <div className="h-[70vh] animate-pulse rounded-xl border bg-white shadow-card" />,
  },
);

export function AnnotationWorkspaceShell({ projectId }: { projectId: string }) {
  return <AnnotationWorkspace projectId={projectId} />;
}
