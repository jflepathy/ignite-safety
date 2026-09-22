-- Session 7: username-based login + account lockout + per-user edit permissions

-- AlterTable: users — add username (login identifier), backfill from the
-- email local-part for existing rows, then enforce NOT NULL + UNIQUE.
-- Also add login attempt-limiting fields.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" TEXT;
UPDATE "users" SET "username" = split_part("email", '@', 1) WHERE "username" IS NULL;
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'users_username_key') THEN
    CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
  END IF;
END $$;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);

-- AlterTable: user_permission_overrides — add `action` ("view" | "edit"),
-- default existing rows to "view" (their original meaning), and widen the
-- unique constraint from (userId, moduleKey) to (userId, moduleKey, action)
-- so a user can have independent view and edit overrides for the same key.
ALTER TABLE "user_permission_overrides" ADD COLUMN IF NOT EXISTS "action" TEXT NOT NULL DEFAULT 'view';

DROP INDEX IF EXISTS "user_permission_overrides_userId_moduleKey_key";
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'user_permission_overrides_userId_moduleKey_action_key') THEN
    CREATE UNIQUE INDEX "user_permission_overrides_userId_moduleKey_action_key" ON "user_permission_overrides"("userId", "moduleKey", "action");
  END IF;
END $$;
