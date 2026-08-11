-- AlterTable
ALTER TABLE "Worker" ADD COLUMN "agentVersion" TEXT;
ALTER TABLE "Worker" ADD COLUMN "capabilitiesJson" TEXT;
ALTER TABLE "Worker" ADD COLUMN "lastError" TEXT;

-- CreateTable
CREATE TABLE "TrainingJobLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trainingJobId" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrainingJobLog_trainingJobId_fkey" FOREIGN KEY ("trainingJobId") REFERENCES "TrainingJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TrainingJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "datasetVersionId" TEXT NOT NULL,
    "workerId" TEXT,
    "baseModel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "epochs" INTEGER NOT NULL,
    "imageSize" INTEGER NOT NULL,
    "batchSize" INTEGER NOT NULL,
    "device" TEXT NOT NULL DEFAULT 'auto',
    "currentEpoch" INTEGER NOT NULL DEFAULT 0,
    "progress" REAL NOT NULL DEFAULT 0,
    "metricsJson" TEXT,
    "lastMessage" TEXT,
    "errorMessage" TEXT,
    "logPath" TEXT,
    "cancelRequestedAt" DATETIME,
    "retryOfJobId" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrainingJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrainingJob_datasetVersionId_fkey" FOREIGN KEY ("datasetVersionId") REFERENCES "DatasetVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TrainingJob_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TrainingJob" ("baseModel", "batchSize", "completedAt", "createdAt", "currentEpoch", "datasetVersionId", "device", "epochs", "id", "imageSize", "logPath", "metricsJson", "projectId", "startedAt", "status", "updatedAt", "workerId") SELECT "baseModel", "batchSize", "completedAt", "createdAt", "currentEpoch", "datasetVersionId", "device", "epochs", "id", "imageSize", "logPath", "metricsJson", "projectId", "startedAt", "status", "updatedAt", "workerId" FROM "TrainingJob";
DROP TABLE "TrainingJob";
ALTER TABLE "new_TrainingJob" RENAME TO "TrainingJob";
CREATE INDEX "TrainingJob_projectId_status_createdAt_idx" ON "TrainingJob"("projectId", "status", "createdAt");
CREATE INDEX "TrainingJob_workerId_status_idx" ON "TrainingJob"("workerId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "TrainingJobLog_trainingJobId_createdAt_idx" ON "TrainingJobLog"("trainingJobId", "createdAt");
