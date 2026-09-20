-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('OPEN', 'PARTIAL', 'PAID', 'OVERDUE', 'VOID');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'OPEN', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('OPEN', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "OpportunityStage" AS ENUM ('PROSPECTING', 'QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('INVENTORY', 'NON_INVENTORY', 'SERVICE', 'BUNDLE');

-- CreateEnum
CREATE TYPE "AccountingMethod" AS ENUM ('ACCRUAL', 'CASH');

-- CreateEnum
CREATE TYPE "PayType" AS ENUM ('HOURLY', 'SALARY');

-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN     "accountingMethod" "AccountingMethod" NOT NULL DEFAULT 'ACCRUAL',
ADD COLUMN     "autoApplyBillPaymentsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "autoPaymentRemindersEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "autoPrefillFormsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "autoSurveyRequestsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "baseCurrency" TEXT NOT NULL DEFAULT 'SCR',
ADD COLUMN     "billNextSeq" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "billPrefix" TEXT NOT NULL DEFAULT 'BILL',
ADD COLUMN     "billableExpenseTrackingEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "billableTimeEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "billableUserLimit" INTEGER,
ADD COLUMN     "booksClosedDate" TIMESTAMP(3),
ADD COLUMN     "businessType" TEXT DEFAULT 'Limited Company',
ADD COLUMN     "chartOfAccountsLimit" INTEGER,
ADD COLUMN     "customFieldsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "customKpiLimit" INTEGER,
ADD COLUMN     "dailyDigestEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "defaultBillTermsDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "defaultInvoiceEmailBody" TEXT DEFAULT 'Hi {{customerName}}, please find your invoice attached. Thank you for your business.',
ADD COLUMN     "defaultInvoiceEmailSubject" TEXT DEFAULT 'Invoice {{invoiceNumber}} from {{companyName}}',
ADD COLUMN     "deliveryMethod" TEXT NOT NULL DEFAULT 'Email',
ADD COLUMN     "depositsOnSalesEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "discountsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "expenseItemizationEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "expenseTaggingEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "fiscalYearStartMonth" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "industry" TEXT DEFAULT 'Fire & Life Safety Services',
ADD COLUMN     "inventoryReceivingEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "journalEntryNextSeq" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "journalEntryPrefix" TEXT NOT NULL DEFAULT 'JE',
ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "multiCurrencyEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "numberFormat" TEXT NOT NULL DEFAULT '#,##0.00',
ADD COLUMN     "preferredPaymentTerms" TEXT NOT NULL DEFAULT 'Due on receipt',
ADD COLUMN     "priceRulesEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "progressInvoicingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "projectTrackingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "purchaseOrderNextSeq" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "purchaseOrderPrefix" TEXT NOT NULL DEFAULT 'PO',
ADD COLUMN     "purchaseOrdersEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "refundReceiptNextSeq" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "refundReceiptPrefix" TEXT NOT NULL DEFAULT 'RR',
ADD COLUMN     "reminderScheduleDays" JSONB NOT NULL DEFAULT '[-3,0,7,14]',
ADD COLUMN     "salesOrderNextSeq" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "salesOrderPrefix" TEXT NOT NULL DEFAULT 'SO',
ADD COLUMN     "salesReceiptNextSeq" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "salesReceiptPrefix" TEXT NOT NULL DEFAULT 'SRC',
ADD COLUMN     "serviceDateEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "skuTrackingEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "supplierCreditNextSeq" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "supplierCreditPrefix" TEXT NOT NULL DEFAULT 'SC',
ADD COLUMN     "tagsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "taxInclusivePricing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "taxYearStartMonth" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "timesheetFields" JSONB NOT NULL DEFAULT '["service","customer","billable"]',
ADD COLUMN     "transactionNumberingEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "warnOnDuplicateBillNumber" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "warnOnDuplicateCheckNumber" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "weekStartDay" TEXT NOT NULL DEFAULT 'Monday',
ALTER COLUMN "uiModules" SET DEFAULT '{"historicalData":true,"recycleBin":true,"reports":true,"outreach":true,"workOrders":true,"billing":true,"settings":true,"accounting":true,"expenses":true,"customerHub":true,"team":true,"inventory":true,"tax":true,"marketing":true}';

-- AlterTable
ALTER TABLE "shop_items" ADD COLUMN     "cost" DECIMAL(12,2),
ADD COLUMN     "expenseAccountId" TEXT,
ADD COLUMN     "incomeAccountId" TEXT,
ADD COLUMN     "itemType" "ItemType" NOT NULL DEFAULT 'NON_INVENTORY',
ADD COLUMN     "quantityOnHand" INTEGER DEFAULT 0,
ADD COLUMN     "reorderPoint" INTEGER;

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "subtype" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "companyName" TEXT,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "taxId" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bills" (
    "id" TEXT NOT NULL,
    "billNumber" TEXT NOT NULL,
    "supplierRef" TEXT,
    "supplierId" TEXT NOT NULL,
    "status" "BillStatus" NOT NULL DEFAULT 'OPEN',
    "billDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balanceDue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "terms" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_line_items" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "shopItemId" TEXT,
    "accountId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "bill_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_payments" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "reference" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "supplier_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDate" TIMESTAMP(3),
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_line_items" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "shopItemId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "quantityReceived" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "purchase_order_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_credits" (
    "id" TEXT NOT NULL,
    "creditNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "billId" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_orders" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'OPEN',
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "globalDiscountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_line_items" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "shopItemId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxRateId" TEXT,
    "lineTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sales_order_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_receipts" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "saleDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_receipt_line_items" (
    "id" TEXT NOT NULL,
    "salesReceiptId" TEXT NOT NULL,
    "shopItemId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxRateId" TEXT,
    "lineTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "sales_receipt_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund_receipts" (
    "id" TEXT NOT NULL,
    "refundNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "refundDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "reason" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refund_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund_receipt_line_items" (
    "id" TEXT NOT NULL,
    "refundReceiptId" TEXT NOT NULL,
    "shopItemId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "refund_receipt_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "source" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "assignedToId" TEXT,
    "convertedCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerId" TEXT,
    "leadId" TEXT,
    "stage" "OpportunityStage" NOT NULL DEFAULT 'PROSPECTING',
    "estimatedValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "probabilityPercent" INTEGER NOT NULL DEFAULT 50,
    "expectedCloseDate" TIMESTAMP(3),
    "notes" TEXT,
    "assignedToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "jobTitle" TEXT,
    "department" TEXT,
    "hireDate" TIMESTAMP(3),
    "payType" "PayType" NOT NULL DEFAULT 'HOURLY',
    "payRate" DECIMAL(10,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_activities" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workOrderId" TEXT,
    "customerId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hours" DECIMAL(5,2) NOT NULL,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "serviceDescription" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountType" TEXT NOT NULL DEFAULT 'CHECKING',
    "accountNumberMasked" TEXT,
    "openingBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currentBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT 'SCR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transactions" (
    "id" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reconciled" BOOLEAN NOT NULL DEFAULT false,
    "matchedInvoiceId" TEXT,
    "matchedBillId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposits" (
    "id" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(12,2) NOT NULL,
    "memo" TEXT,
    "paymentIds" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deposits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_transfers" (
    "id" TEXT NOT NULL,
    "fromAccountId" TEXT NOT NULL,
    "toAccountId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "memo" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "entryNumber" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "memo" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_lines" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "debit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "description" TEXT,

    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_adjustments" (
    "id" TEXT NOT NULL,
    "shopItemId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quantityChange" INTEGER NOT NULL,
    "reason" TEXT,
    "memo" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSizeBytes" INTEGER,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#64748b',

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tagged_entities" (
    "id" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,

    CONSTRAINT "tagged_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_fields" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "appliesTo" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL DEFAULT 'TEXT',
    "options" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "intervalCount" INTEGER NOT NULL DEFAULT 1,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "nextRunDate" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT,
    "templateData" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_code_key" ON "accounts"("code");

-- CreateIndex
CREATE INDEX "suppliers_displayName_idx" ON "suppliers"("displayName");

-- CreateIndex
CREATE UNIQUE INDEX "bills_billNumber_key" ON "bills"("billNumber");

-- CreateIndex
CREATE INDEX "bills_status_idx" ON "bills"("status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_poNumber_key" ON "purchase_orders"("poNumber");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_credits_creditNumber_key" ON "supplier_credits"("creditNumber");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_orderNumber_key" ON "sales_orders"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "sales_receipts_receiptNumber_key" ON "sales_receipts"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "refund_receipts_refundNumber_key" ON "refund_receipts"("refundNumber");

-- CreateIndex
CREATE UNIQUE INDEX "employees_userId_key" ON "employees"("userId");

-- CreateIndex
CREATE INDEX "time_activities_employeeId_idx" ON "time_activities"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_accountId_key" ON "bank_accounts"("accountId");

-- CreateIndex
CREATE INDEX "bank_transactions_bankAccountId_idx" ON "bank_transactions"("bankAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_entryNumber_key" ON "journal_entries"("entryNumber");

-- CreateIndex
CREATE INDEX "attachments_entityType_entityId_idx" ON "attachments"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE INDEX "tagged_entities_entityType_entityId_idx" ON "tagged_entities"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "tagged_entities_tagId_entityType_entityId_key" ON "tagged_entities"("tagId", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "shop_items" ADD CONSTRAINT "shop_items_incomeAccountId_fkey" FOREIGN KEY ("incomeAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_items" ADD CONSTRAINT "shop_items_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_line_items" ADD CONSTRAINT "bill_line_items_billId_fkey" FOREIGN KEY ("billId") REFERENCES "bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_line_items" ADD CONSTRAINT "bill_line_items_shopItemId_fkey" FOREIGN KEY ("shopItemId") REFERENCES "shop_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_billId_fkey" FOREIGN KEY ("billId") REFERENCES "bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_line_items" ADD CONSTRAINT "purchase_order_line_items_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_line_items" ADD CONSTRAINT "purchase_order_line_items_shopItemId_fkey" FOREIGN KEY ("shopItemId") REFERENCES "shop_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_credits" ADD CONSTRAINT "supplier_credits_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_line_items" ADD CONSTRAINT "sales_order_line_items_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_line_items" ADD CONSTRAINT "sales_order_line_items_shopItemId_fkey" FOREIGN KEY ("shopItemId") REFERENCES "shop_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_line_items" ADD CONSTRAINT "sales_order_line_items_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "tax_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_receipts" ADD CONSTRAINT "sales_receipts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_receipt_line_items" ADD CONSTRAINT "sales_receipt_line_items_salesReceiptId_fkey" FOREIGN KEY ("salesReceiptId") REFERENCES "sales_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_receipt_line_items" ADD CONSTRAINT "sales_receipt_line_items_shopItemId_fkey" FOREIGN KEY ("shopItemId") REFERENCES "shop_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_receipt_line_items" ADD CONSTRAINT "sales_receipt_line_items_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "tax_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_receipts" ADD CONSTRAINT "refund_receipts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_receipt_line_items" ADD CONSTRAINT "refund_receipt_line_items_refundReceiptId_fkey" FOREIGN KEY ("refundReceiptId") REFERENCES "refund_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_receipt_line_items" ADD CONSTRAINT "refund_receipt_line_items_shopItemId_fkey" FOREIGN KEY ("shopItemId") REFERENCES "shop_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_activities" ADD CONSTRAINT "time_activities_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_transfers" ADD CONSTRAINT "account_transfers_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_transfers" ADD CONSTRAINT "account_transfers_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_shopItemId_fkey" FOREIGN KEY ("shopItemId") REFERENCES "shop_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tagged_entities" ADD CONSTRAINT "tagged_entities_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
