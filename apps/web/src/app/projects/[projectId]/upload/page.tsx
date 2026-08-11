import { UploadWorkspace } from "@/components/upload/upload-workspace";

export default async function UploadPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <UploadWorkspace projectId={projectId} />;
}
