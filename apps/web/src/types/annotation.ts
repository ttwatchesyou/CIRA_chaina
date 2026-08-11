export type AnnotationImageItem = {
  id: string;
  filename: string;
  width: number;
  height: number;
  status: "ANNOTATED" | "UNANNOTATED";
  annotationCount: number;
  uploadedAt: string;
  thumbnailUrl: string;
  fileUrl: string;
};

export type AnnotationClassItem = {
  id: string;
  name: string;
  color: string;
  annotationCount: number;
};

export type AnnotationBox = {
  id: string;
  classId: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AnnotationWorkspaceData = {
  projectId: string;
  projectName: string;
  images: AnnotationImageItem[];
  classes: AnnotationClassItem[];
};

export type AnnotationSaveResult = {
  status: "ANNOTATED" | "UNANNOTATED";
  annotationCount: number;
  classCounts: Record<string, number>;
  savedAt: string;
};
