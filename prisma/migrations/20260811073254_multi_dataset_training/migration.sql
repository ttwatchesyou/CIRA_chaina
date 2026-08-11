-- AlterTable
ALTER TABLE "TrainingJob" ADD COLUMN "datasetBundlePath" TEXT;

-- CreateTable
CREATE TABLE "TrainingJobDataset" (
    "trainingJobId" TEXT NOT NULL,
    "datasetVersionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("trainingJobId", "datasetVersionId"),
    CONSTRAINT "TrainingJobDataset_trainingJobId_fkey" FOREIGN KEY ("trainingJobId") REFERENCES "TrainingJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrainingJobDataset_datasetVersionId_fkey" FOREIGN KEY ("datasetVersionId") REFERENCES "DatasetVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Preserve the Dataset linked by Training Jobs created before multi-Dataset support.
INSERT INTO "TrainingJobDataset" ("trainingJobId", "datasetVersionId", "sortOrder")
SELECT "id", "datasetVersionId", 0 FROM "TrainingJob";

-- CreateIndex
CREATE INDEX "TrainingJobDataset_datasetVersionId_idx" ON "TrainingJobDataset"("datasetVersionId");

-- CreateIndex
CREATE INDEX "TrainingJobDataset_trainingJobId_sortOrder_idx" ON "TrainingJobDataset"("trainingJobId", "sortOrder");
