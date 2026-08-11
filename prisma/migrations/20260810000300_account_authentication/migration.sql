-- Add credential fields to the existing extensible user record.
ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- Sessions hold only a hash of the HttpOnly browser token.
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");

-- Development accounts requested for the initial internal deployment.
INSERT INTO "User" ("id", "name", "username", "passwordHash", "createdAt", "updatedAt")
VALUES
  ('account_mo', 'mo', 'mo', '$2b$12$T6ovKtzpt/x7R/evYRv8aO2G2x5.TFs242nOXzX/SBNLZLlGVZT3q', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('account_manoaw', 'manoaw', 'manoaw', '$2b$12$9u6WrBJFvLrPCO3fz0bK3.MbJIIRa7sEFhIIrRC7I6.3r5WhPMgmi', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Preserve existing local work by assigning projects created before accounts to mo.
UPDATE "Project" SET "createdById" = 'account_mo' WHERE "createdById" IS NULL;
