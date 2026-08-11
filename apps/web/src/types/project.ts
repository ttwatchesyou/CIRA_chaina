export type ProjectSummary = {
  id: string;
  name: string;
  description: string | null;
  type: "OBJECT_DETECTION";
  createdAt: string;
  updatedAt: string;
  counts: {
    images: number;
    annotatedImages: number;
    classes: number;
    datasets: number;
    models: number;
    jobs: number;
  };
};

export type ProjectActivity = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
};

export type ProjectOverview = ProjectSummary & {
  activities: ProjectActivity[];
};
