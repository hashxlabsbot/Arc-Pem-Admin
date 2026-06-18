-- AlterTable: flag users acquired during the early-access launch window.
ALTER TABLE "User" ADD COLUMN "earlyAccess" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: generic key/value app configuration (e.g. earlyAccessOpen toggle).
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex: admin counts/filters the early-access cohort.
CREATE INDEX "User_earlyAccess_idx" ON "User"("earlyAccess");
