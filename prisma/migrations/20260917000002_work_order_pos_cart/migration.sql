-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN     "invoiceNumberIfIssued" TEXT,
ADD COLUMN     "serviceLines" JSONB NOT NULL DEFAULT '[]';

