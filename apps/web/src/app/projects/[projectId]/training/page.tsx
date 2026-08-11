import { notFound } from "next/navigation";

import { TrainingWorkspace } from "@/components/training/training-workspace";
import { requireUser } from "@/lib/auth";
import { getTrainingWorkspace } from "@/server/services/training.service";

export const dynamic = "force-dynamic";

type TrainingPageProps = { params: Promise<{ projectId: string }> };

export default async function TrainingPage({ params }: TrainingPageProps) {
  const { projectId } = await params;
  const user = await requireUser();
  const workspace = await getTrainingWorkspace(projectId, user.id);
  if (!workspace) notFound();
  return <TrainingWorkspace initialData={workspace} />;
}

