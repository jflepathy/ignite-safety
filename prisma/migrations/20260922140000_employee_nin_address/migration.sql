-- AlterTable: Employee gains NIN (National Identification Number) and Home
-- Address, captured at registration time (Session 11).
ALTER TABLE "employees" ADD COLUMN "nin" TEXT;
ALTER TABLE "employees" ADD COLUMN "homeAddress" TEXT;
