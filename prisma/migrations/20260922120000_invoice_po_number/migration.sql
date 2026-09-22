-- AlterTable: Invoice gains an optional poNumber (customer's purchase order
-- number), shown under Due Date on the invoice form and printable document
-- (Session 11).
ALTER TABLE "invoices" ADD COLUMN "poNumber" TEXT;
