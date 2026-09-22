-- AlterTable: Expense gains an optional, auto-numbered expenseNumber
-- (EXP-YYYY-####) so each expense has a "form number" like Invoice /
-- Sales Receipt / Estimate, used as the downloaded PDF's filename
-- (Session 11).
ALTER TABLE "expenses" ADD COLUMN "expenseNumber" TEXT;
CREATE UNIQUE INDEX "expenses_expenseNumber_key" ON "expenses"("expenseNumber");

-- AlterTable: AppSettings numbering config for expenses.
ALTER TABLE "app_settings" ADD COLUMN "expensePrefix" TEXT NOT NULL DEFAULT 'EXP';
ALTER TABLE "app_settings" ADD COLUMN "expenseNextSeq" INTEGER NOT NULL DEFAULT 1;
