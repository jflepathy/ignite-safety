-- AlterTable: admin-toggle to allow completing a Work Order in the mobile
-- POS without customer name/signature (Session 12).
ALTER TABLE "app_settings" ADD COLUMN "requireCustomerSignoff" BOOLEAN NOT NULL DEFAULT true;
