import { DatasetWorkspace } from "@/components/dataset/dataset-workspace";

type DatasetPageProps = { params: Promise<{ projectId: string }> };

export default async function DatasetPage({ params }: DatasetPageProps) {
  const { projectId } = await params;
  return <DatasetWorkspace projectId={projectId} />;
}
