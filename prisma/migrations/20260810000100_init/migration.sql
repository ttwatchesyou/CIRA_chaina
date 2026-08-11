-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'OBJECT_DETECTION',
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "Project_updatedAt_idx" ON "Project"("updatedAt");

-- CreateTable
CREATE TABLE "Image" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalPath" TEXT NOT NULL,
    "thumbnailPath" TEXT,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'UNANNOTATED',
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Image_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Image_projectId_sha256_key" ON "Image"("projectId", "sha256");
CREATE INDEX "Image_projectId_status_uploadedAt_idx" ON "Image"("projectId", "status", "uploadedAt");

-- CreateTable
CREATE TABLE "VisionClass" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VisionClass_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "VisionClass_projectId_name_key" ON "VisionClass"("projectId", "name");

-- CreateTable
CREATE TABLE "Annotation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "imageId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "width" REAL NOT NULL,
    "height" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Annotation_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Annotation_classId_fkey" FOREIGN KEY ("classId") REFERENCES "VisionClass" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Annotation_imageId_idx" ON "Annotation"("imageId");
CREATE INDEX "Annotation_classId_idx" ON "Annotation"("classId");

-- CreateTable
CREATE TABLE "DatasetVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'YOLO',
    "status" TEXT NOT NULL DEFAULT 'READY',
    "trainPercent" INTEGER NOT NULL,
    "validationPercent" INTEGER NOT NULL,
    "testPercent" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL DEFAULT 0,
    "classSnapshotJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DatasetVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DatasetVersion_projectId_version_key" ON "DatasetVersion"("projectId", "version");
CREATE INDEX "DatasetVersion_projectId_createdAt_idx" ON "DatasetVersion"("projectId", "createdAt");

-- CreateTable
CREATE TABLE "DatasetImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "datasetVersionId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "split" TEXT NOT NULL,
    "labelPath" TEXT NOT NULL,
    CONSTRAINT "DatasetImage_datasetVersionId_fkey" FOREIGN KEY ("datasetVersionId") REFERENCES "DatasetVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DatasetImage_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DatasetImage_datasetVersionId_imageId_key" ON "DatasetImage"("datasetVersionId", "imageId");
CREATE INDEX "DatasetImage_datasetVersionId_split_idx" ON "DatasetImage"("datasetVersionId", "split");

-- CreateTable
CREATE TABLE "Worker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workerKey" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "ipAddress" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OFFLINE',
    "cpu" TEXT,
    "cpuUsage" REAL,
    "ramTotalMb" INTEGER,
    "ramUsedMb" INTEGER,
    "gpu" TEXT,
    "gpuMemoryMb" INTEGER,
    "gpuMemoryUsedMb" INTEGER,
    "os" TEXT,
    "lastHeartbeatAt" DATETIME,
    "registeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "Worker_workerKey_key" ON "Worker"("workerKey");
CREATE INDEX "Worker_status_lastHeartbeatAt_idx" ON "Worker"("status", "lastHeartbeatAt");

-- CreateTable
CREATE TABLE "TrainingJob" (
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
    "metricsJson" TEXT,
    "logPath" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrainingJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrainingJob_datasetVersionId_fkey" FOREIGN KEY ("datasetVersionId") REFERENCES "DatasetVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TrainingJob_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "TrainingJob_projectId_status_createdAt_idx" ON "TrainingJob"("projectId", "status", "createdAt");
CREATE INDEX "TrainingJob_workerId_status_idx" ON "TrainingJob"("workerId", "status");

-- CreateTable
CREATE TABLE "ModelArtifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "trainingJobId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseModel" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "lastCheckpointPath" TEXT,
    "resultsPath" TEXT,
    "map50" REAL,
    "map50_95" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModelArtifact_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ModelArtifact_trainingJobId_fkey" FOREIGN KEY ("trainingJobId") REFERENCES "TrainingJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ModelArtifact_trainingJobId_key" ON "ModelArtifact"("trainingJobId");
CREATE INDEX "ModelArtifact_projectId_createdAt_idx" ON "ModelArtifact"("projectId", "createdAt");

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ActivityLog_projectId_createdAt_idx" ON "ActivityLog"("projectId", "createdAt");
