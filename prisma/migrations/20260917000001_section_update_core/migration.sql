-- AlterEnum

-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN     "bankAccountName" TEXT,
ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "fxAutoUpdateEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "fxLastFetchedAt" TIMESTAMP(3),
ADD COLUMN     "fxRateLockEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "itemSkuNextSeq" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "itemSkuPrefix" TEXT NOT NULL DEFAULT 'ITM',
ADD COLUMN     "paymentInstructions" TEXT DEFAULT '1. Cash
2. Credit / Debit Card
3. Cheque
4. Bank Transfer
5. Approved PO';

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "district" TEXT;

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "contractEndDate" TIMESTAMP(3),
ADD COLUMN     "employmentType" TEXT DEFAULT 'Permanent',
ADD COLUMN     "standardHoursPerWeek" DECIMAL(5,2) DEFAULT 40,
ALTER COLUMN "payType" SET DEFAULT 'MONTHLY';

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "accountId" TEXT,
ADD COLUMN     "supplierId" TEXT;

-- CreateTable
CREATE TABLE "user_permission_overrides" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_permission_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "rateToBase" DECIMAL(18,6) NOT NULL,
    "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT DEFAULT 'manual',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_permission_overrides_userId_moduleKey_key" ON "user_permission_overrides"("userId", "moduleKey");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_currencyCode_key" ON "exchange_rates"("currencyCode");

-- CreateIndex
CREATE INDEX "expenses_accountId_idx" ON "expenses"("accountId");

-- AddForeignKey
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

