-- CreateEnum (only if it doesn't exist)
DO $$ BEGIN
    CREATE TYPE "PrivacyLevel" AS ENUM ('PUBLIC', 'FRIENDS_ONLY', 'PRIVATE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable profiles (only if column doesn't exist)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'privacy'
    ) THEN
        ALTER TABLE "profiles" ADD COLUMN "privacy" "PrivacyLevel" NOT NULL DEFAULT 'PUBLIC';
    END IF;
END $$;

-- CreateTable friendships (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS "friendships" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "friendships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (only if it doesn't exist)
CREATE UNIQUE INDEX IF NOT EXISTS "friendships_senderId_receiverId_key" ON "friendships"("senderId", "receiverId");

CREATE INDEX IF NOT EXISTS "friendships_senderId_idx" ON "friendships"("senderId");

CREATE INDEX IF NOT EXISTS "friendships_receiverId_idx" ON "friendships"("receiverId");

CREATE INDEX IF NOT EXISTS "friendships_status_idx" ON "friendships"("status");

-- AddForeignKey (drop first if exists to avoid conflicts)
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'friendships_senderId_fkey'
    ) THEN
        ALTER TABLE "friendships" DROP CONSTRAINT "friendships_senderId_fkey";
    END IF;
END $$;

ALTER TABLE "friendships" ADD CONSTRAINT "friendships_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'friendships_receiverId_fkey'
    ) THEN
        ALTER TABLE "friendships" DROP CONSTRAINT "friendships_receiverId_fkey";
    END IF;
END $$;

ALTER TABLE "friendships" ADD CONSTRAINT "friendships_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

