ALTER TABLE "sales_receipts" ADD COLUMN "shareToken" TEXT;
CREATE UNIQUE INDEX "sales_receipts_shareToken_key" ON "sales_receipts"("shareToken");
ALTER TABLE "customers" ADD COLUMN "statementToken" TEXT;
CREATE UNIQUE INDEX "customers_statementToken_key" ON "customers"("statementToken");
ALTER TABLE "work_orders" ADD COLUMN "certificateNumber" TEXT;
ALTER TABLE "work_orders" ADD COLUMN "certificateIssuedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "work_orders_certificateNumber_key" ON "work_orders"("certificateNumber");
ALTER TABLE "app_settings" ADD COLUMN "vatFilingFrequency" TEXT NOT NULL DEFAULT 'MONTHLY';
ALTER TABLE "app_settings" ADD COLUMN "vatDueDay" INTEGER NOT NULL DEFAULT 21;

CREATE TABLE "servicing_batches" (
  "id" TEXT NOT NULL,
  "customerId" TEXT,
  "clientName" TEXT NOT NULL,
  "address" TEXT,
  "phone" TEXT,
  "batchMonth" TIMESTAMP(3) NOT NULL,
  "serviceDate" TIMESTAMP(3) NOT NULL,
  "nextDueDate" TIMESTAMP(3) NOT NULL,
  "extinguishers" INTEGER NOT NULL DEFAULT 0,
  "hoseReels" INTEGER NOT NULL DEFAULT 0,
  "fireBlankets" INTEGER NOT NULL DEFAULT 0,
  "detectors" INTEGER NOT NULL DEFAULT 0,
  "otherItems" INTEGER NOT NULL DEFAULT 0,
  "source" TEXT NOT NULL,
  "sourceRef" TEXT,
  "notes" TEXT,
  "dedupeKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "servicing_batches_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "servicing_batches_dedupeKey_key" ON "servicing_batches"("dedupeKey");
CREATE INDEX "servicing_batches_customerId_idx" ON "servicing_batches"("customerId");
CREATE INDEX "servicing_batches_batchMonth_idx" ON "servicing_batches"("batchMonth");
CREATE INDEX "servicing_batches_nextDueDate_idx" ON "servicing_batches"("nextDueDate");
ALTER TABLE "servicing_batches" ADD CONSTRAINT "servicing_batches_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "vat_returns" (
  "id" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "outputTax" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "inputTax" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "outputAdjustment" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "inputAdjustment" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "netPayable" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "taxableSales" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalSales" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "filedAt" TIMESTAMP(3),
  "filedReference" TEXT,
  "paidAt" TIMESTAMP(3),
  "paidAmount" DECIMAL(12,2),
  "paymentReference" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vat_returns_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "vat_returns_periodStart_idx" ON "vat_returns"("periodStart");

CREATE TABLE "reminder_logs" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "offsetDays" INTEGER NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "toEmail" TEXT,
  CONSTRAINT "reminder_logs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "reminder_logs_invoiceId_offsetDays_key" ON "reminder_logs"("invoiceId","offsetDays");

CREATE TABLE "cron_runs" (
  "id" TEXT NOT NULL,
  "job" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ok" BOOLEAN NOT NULL DEFAULT true,
  "summary" TEXT,
  CONSTRAINT "cron_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "cron_runs_job_startedAt_idx" ON "cron_runs"("job","startedAt");
