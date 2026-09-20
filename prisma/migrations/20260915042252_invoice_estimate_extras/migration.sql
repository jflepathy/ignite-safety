-- AlterTable
ALTER TABLE "estimates" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "acceptedByName" TEXT,
ADD COLUMN     "customerMessage" TEXT,
ADD COLUMN     "shareToken" TEXT,
ADD COLUMN     "taxInclusive" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "customerMessage" TEXT,
ADD COLUMN     "customerPaymentOptions" JSONB,
ADD COLUMN     "isRecurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recurringTemplateId" TEXT,
ADD COLUMN     "shareToken" TEXT,
ADD COLUMN     "taxInclusive" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "estimates_shareToken_key" ON "estimates"("shareToken");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_shareToken_key" ON "invoices"("shareToken");

