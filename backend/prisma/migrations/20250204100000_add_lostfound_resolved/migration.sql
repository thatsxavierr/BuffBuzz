-- AlterTable lostfound_items: add resolved flag (poster can mark item as recovered)
ALTER TABLE "lostfound_items" ADD COLUMN IF NOT EXISTS "resolved" BOOLEAN NOT NULL DEFAULT false;
