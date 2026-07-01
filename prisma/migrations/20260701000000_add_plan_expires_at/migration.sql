-- AlterTable: end of the current one-year license term for a paid user.
-- Nullable + no default → fully additive, no backfill, safe forward-only deploy.
ALTER TABLE "User" ADD COLUMN "planExpiresAt" TIMESTAMP(3);
