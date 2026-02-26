-- AlterTable jobs: add optional application deadline
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "applicationDeadline" TIMESTAMP(3);
