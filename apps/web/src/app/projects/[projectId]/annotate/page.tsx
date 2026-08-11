import { AnnotationWorkspaceShell } from "@/components/annotation/annotation-workspace-shell";

type AnnotatePageProps = { params: Promise<{ projectId: string }> };

export default async function AnnotatePage({ params }: AnnotatePageProps) {
  const { projectId } = await params;
  return <AnnotationWorkspaceShell projectId={projectId} />;
}
