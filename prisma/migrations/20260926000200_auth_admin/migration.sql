CREATE TABLE "RateLimit" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 1,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key"),
  CONSTRAINT "RateLimit_count_check" CHECK ("count" > 0)
);
CREATE INDEX "RateLimit_expiresAt_idx" ON "RateLimit"("expiresAt");
-- Emails are normalized by the application; enforce uniqueness regardless of casing.
CREATE UNIQUE INDEX "User_email_lower_key" ON "User" (lower("email"));
