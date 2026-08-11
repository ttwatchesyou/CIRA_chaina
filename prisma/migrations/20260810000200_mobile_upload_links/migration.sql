-- CreateTable
CREATE TABLE "UploadAccessToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UploadAccessToken_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "UploadAccessToken_tokenHash_key" ON "UploadAccessToken"("tokenHash");
CREATE INDEX "UploadAccessToken_projectId_expiresAt_idx" ON "UploadAccessToken"("projectId", "expiresAt");
