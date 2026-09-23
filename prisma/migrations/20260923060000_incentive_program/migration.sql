-- Technician Incentive Program (Session 16)

-- AppSettings: default incentive fraction + technician-collections bank account
ALTER TABLE "app_settings" ADD COLUMN "defaultIncentiveFraction" DECIMAL(5,4) NOT NULL DEFAULT 0.20;
ALTER TABLE "app_settings" ADD COLUMN "technicianCollectionsBankAccountId" TEXT;

-- Payment: verification workflow for technician-collected cheque/transfer proof photos
CREATE TYPE "PaymentVerificationStatus" AS ENUM ('NONE', 'PENDING_REVIEW', 'CONFIRMED', 'MISMATCH');

ALTER TABLE "payments" ADD COLUMN "verificationStatus" "PaymentVerificationStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "payments" ADD COLUMN "proofPhotoUrl" TEXT;
ALTER TABLE "payments" ADD COLUMN "proofNotes" TEXT;
ALTER TABLE "payments" ADD COLUMN "verifiedAt" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN "verifiedById" TEXT;

-- IncentiveRate: one row per billable service key
CREATE TABLE "incentive_rates" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "shopItemId" TEXT,
    "fractionOverride" DECIMAL(5,4),
    "flatAmount" DECIMAL(12,2),
    "bundledShopItemId" TEXT,
    "bundledQuantityPerUnit" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incentive_rates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "incentive_rates_key_key" ON "incentive_rates"("key");

ALTER TABLE "incentive_rates" ADD CONSTRAINT "incentive_rates_shopItemId_fkey" FOREIGN KEY ("shopItemId") REFERENCES "shop_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "incentive_rates" ADD CONSTRAINT "incentive_rates_bundledShopItemId_fkey" FOREIGN KEY ("bundledShopItemId") REFERENCES "shop_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
