-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "businessRegistrationNumber" TEXT;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "registeredOwners" TEXT;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "faviconUrl" TEXT;
