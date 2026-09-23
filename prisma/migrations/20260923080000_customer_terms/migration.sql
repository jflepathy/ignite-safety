-- Adds a per-customer default invoice Terms field (Session 18).
ALTER TABLE "customers" ADD COLUMN "terms" TEXT;
