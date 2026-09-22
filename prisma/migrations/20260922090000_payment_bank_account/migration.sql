-- AlterTable: Payment gains an optional bankAccountId so recording a
-- payment actually moves the right BankAccount's balance instead of
-- vanishing into an untracked row (Session 10 fix).
ALTER TABLE "payments" ADD COLUMN "bankAccountId" TEXT;

-- CreateIndex
CREATE INDEX "payments_bankAccountId_idx" ON "payments"("bankAccountId");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
