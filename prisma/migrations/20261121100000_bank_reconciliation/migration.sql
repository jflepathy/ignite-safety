CREATE TABLE "bank_statement_imports" (
  "id" TEXT NOT NULL,
  "bankAccountId" TEXT NOT NULL,
  "fileName" TEXT,
  "fromDate" TIMESTAMP(3),
  "toDate" TIMESTAMP(3),
  "openingBalance" DECIMAL(14,2),
  "closingBalance" DECIMAL(14,2),
  "rowCount" INTEGER NOT NULL DEFAULT 0,
  "importedCount" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bank_statement_imports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "bank_statement_imports_bankAccountId_idx" ON "bank_statement_imports"("bankAccountId");
ALTER TABLE "bank_statement_imports" ADD CONSTRAINT "bank_statement_imports_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_transactions" ADD COLUMN "reference" TEXT;
ALTER TABLE "bank_transactions" ADD COLUMN "balance" DECIMAL(14,2);
ALTER TABLE "bank_transactions" ADD COLUMN "importId" TEXT;
ALTER TABLE "bank_transactions" ADD COLUMN "dedupeKey" TEXT;
ALTER TABLE "bank_transactions" ADD COLUMN "matchType" TEXT;
ALTER TABLE "bank_transactions" ADD COLUMN "matchId" TEXT;
ALTER TABLE "bank_transactions" ADD COLUMN "matchedAt" TIMESTAMP(3);
ALTER TABLE "bank_transactions" ADD COLUMN "excluded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "bank_transactions" ADD COLUMN "note" TEXT;
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_importId_fkey" FOREIGN KEY ("importId") REFERENCES "bank_statement_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "bank_transactions_bankAccountId_dedupeKey_key" ON "bank_transactions"("bankAccountId", "dedupeKey");
CREATE INDEX "bank_transactions_matchType_matchId_idx" ON "bank_transactions"("matchType", "matchId");
