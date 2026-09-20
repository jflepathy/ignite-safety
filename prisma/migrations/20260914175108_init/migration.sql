-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'SALES', 'TECHNICIAN');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('INDIVIDUAL', 'COMPANY', 'GOVERNMENT');

-- CreateEnum
CREATE TYPE "EquipmentCategory" AS ENUM ('FIRE_EXTINGUISHER', 'HOSE_REEL', 'SUPPRESSION_SYSTEM', 'FIRE_BLANKET', 'LIFE_RAFT', 'SMOKE_DETECTOR', 'EMERGENCY_LIGHT', 'FIRE_ALARM_PANEL', 'OTHER');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('ONSITE', 'WORKSHOP');

-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('NEW', 'SCHEDULED', 'CONVERTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('PENDING', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'PAST_DUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIAL', 'PAID', 'OVERDUE', 'VOID');

-- CreateEnum
CREATE TYPE "EstimateStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "CreditNoteStatus" AS ENUM ('DRAFT', 'ISSUED', 'APPLIED', 'VOID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'OTHER');

-- CreateEnum
CREATE TYPE "PassFailStatus" AS ENUM ('PASS', 'FAIL', 'NA');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'SALES',
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "type" "CustomerType" NOT NULL DEFAULT 'COMPANY',
    "contactPerson" TEXT,
    "phone" TEXT,
    "altPhone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "region" TEXT,
    "taxId" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_sites" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "buildingName" TEXT,
    "address" TEXT,
    "region" TEXT,
    "district" TEXT,
    "gpsLat" DOUBLE PRECISION,
    "gpsLng" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_type_catalog" (
    "id" TEXT NOT NULL,
    "category" "EquipmentCategory" NOT NULL,
    "label" TEXT NOT NULL,
    "defaultIntervalMonths" INTEGER NOT NULL DEFAULT 12,
    "requiresHydrostatic" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "equipment_type_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "siteId" TEXT,
    "category" "EquipmentCategory" NOT NULL,
    "typeCatalogId" TEXT,
    "serialNumber" TEXT,
    "make" TEXT,
    "model" TEXT,
    "locationDescription" TEXT,
    "installDate" TIMESTAMP(3),
    "lastServiceDate" TIMESTAMP(3),
    "intervalMonths" INTEGER NOT NULL DEFAULT 12,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_items" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_requests" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "siteId" TEXT,
    "serviceType" "ServiceType" NOT NULL DEFAULT 'ONSITE',
    "proposedDate" TIMESTAMP(3) NOT NULL,
    "region" TEXT,
    "district" TEXT,
    "locationDetails" TEXT,
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'NEW',
    "sourceEquipmentId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_request_equipment_counts" (
    "id" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "category" "EquipmentCategory" NOT NULL,
    "typeCatalogId" TEXT,
    "tentativeCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "service_request_equipment_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_capacity_overrides" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "teamsAvailable" INTEGER NOT NULL,
    "note" TEXT,

    CONSTRAINT "daily_capacity_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" TEXT NOT NULL,
    "woNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "siteId" TEXT,
    "serviceRequestId" TEXT,
    "serviceType" "ServiceType" NOT NULL DEFAULT 'ONSITE',
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledDate" TIMESTAMP(3),
    "assignedTechnicianId" TEXT,
    "region" TEXT,
    "locationDetails" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "customerSignedName" TEXT,
    "customerSignatureDataUrl" TEXT,
    "technicianNotes" TEXT,
    "invoiceId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_inspection_items" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "equipmentId" TEXT,
    "category" "EquipmentCategory" NOT NULL,
    "serialNumber" TEXT,
    "passFail" "PassFailStatus" NOT NULL DEFAULT 'NA',
    "replacementParts" TEXT,
    "hydrostaticTestDone" BOOLEAN NOT NULL DEFAULT false,
    "hydrostaticNotes" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_inspection_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_rates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ratePercent" DECIMAL(5,2) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "globalDiscountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balanceDue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "terms" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "shopItemId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxRateId" TEXT,
    "lineTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimates" (
    "id" TEXT NOT NULL,
    "estimateNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "EstimateStatus" NOT NULL DEFAULT 'DRAFT',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiryDate" TIMESTAMP(3),
    "globalDiscountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_line_items" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "shopItemId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxRateId" TEXT,
    "lineTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "estimate_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_notes" (
    "id" TEXT NOT NULL,
    "creditNoteNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "status" "CreditNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_note_line_items" (
    "id" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "shopItemId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxRateId" TEXT,
    "lineTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "credit_note_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "reference" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "companyName" TEXT NOT NULL DEFAULT 'Ignite Safety',
    "companyAddress" TEXT,
    "companyPhone" TEXT,
    "companyEmail" TEXT,
    "taxRegistrationNumber" TEXT,
    "currencyCode" TEXT NOT NULL DEFAULT 'SCR',
    "logoUrl" TEXT,
    "invoiceTermsDefault" TEXT DEFAULT 'Payment due within 30 days.',
    "invoicePrefix" TEXT NOT NULL DEFAULT 'INV',
    "invoiceNextSeq" INTEGER NOT NULL DEFAULT 1,
    "estimatePrefix" TEXT NOT NULL DEFAULT 'EST',
    "estimateNextSeq" INTEGER NOT NULL DEFAULT 1,
    "creditNotePrefix" TEXT NOT NULL DEFAULT 'CN',
    "creditNoteNextSeq" INTEGER NOT NULL DEFAULT 1,
    "workOrderPrefix" TEXT NOT NULL DEFAULT 'WO',
    "workOrderNextSeq" INTEGER NOT NULL DEFAULT 1,
    "serviceRequestPrefix" TEXT NOT NULL DEFAULT 'SR',
    "serviceRequestNextSeq" INTEGER NOT NULL DEFAULT 1,
    "dailyTeamCapacity" INTEGER NOT NULL DEFAULT 3,
    "smartRemindersEnabled" BOOLEAN NOT NULL DEFAULT true,
    "overdueThresholdDays" INTEGER NOT NULL DEFAULT 30,
    "defaultServiceIntervalMonths" INTEGER NOT NULL DEFAULT 12,
    "reminderLeadDays" INTEGER NOT NULL DEFAULT 45,
    "defaultTaxRateId" TEXT,
    "discountLimitPercent" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "allowedPaymentMethods" JSONB NOT NULL DEFAULT '["CASH","CARD","BANK_TRANSFER","CHEQUE"]',
    "uiModules" JSONB NOT NULL DEFAULT '{"historicalData":true,"recycleBin":true,"reports":true,"outreach":true,"workOrders":true,"billing":true,"settings":true}',
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "customers_displayName_idx" ON "customers"("displayName");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_type_catalog_category_key" ON "equipment_type_catalog"("category");

-- CreateIndex
CREATE INDEX "equipment_customerId_idx" ON "equipment"("customerId");

-- CreateIndex
CREATE INDEX "equipment_category_idx" ON "equipment"("category");

-- CreateIndex
CREATE UNIQUE INDEX "shop_items_sku_key" ON "shop_items"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "service_requests_requestNumber_key" ON "service_requests"("requestNumber");

-- CreateIndex
CREATE INDEX "service_requests_proposedDate_idx" ON "service_requests"("proposedDate");

-- CreateIndex
CREATE INDEX "service_requests_status_idx" ON "service_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "service_request_equipment_counts_serviceRequestId_category_key" ON "service_request_equipment_counts"("serviceRequestId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "daily_capacity_overrides_date_key" ON "daily_capacity_overrides"("date");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_woNumber_key" ON "work_orders"("woNumber");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_serviceRequestId_key" ON "work_orders"("serviceRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_invoiceId_key" ON "work_orders"("invoiceId");

-- CreateIndex
CREATE INDEX "work_orders_status_idx" ON "work_orders"("status");

-- CreateIndex
CREATE INDEX "work_orders_scheduledDate_idx" ON "work_orders"("scheduledDate");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_customerId_idx" ON "invoices"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "estimates_estimateNumber_key" ON "estimates"("estimateNumber");

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_creditNoteNumber_key" ON "credit_notes"("creditNoteNumber");

-- CreateIndex
CREATE INDEX "payments_invoiceId_idx" ON "payments"("invoiceId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "customer_sites" ADD CONSTRAINT "customer_sites_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "customer_sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_typeCatalogId_fkey" FOREIGN KEY ("typeCatalogId") REFERENCES "equipment_type_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "customer_sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request_equipment_counts" ADD CONSTRAINT "service_request_equipment_counts_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request_equipment_counts" ADD CONSTRAINT "service_request_equipment_counts_typeCatalogId_fkey" FOREIGN KEY ("typeCatalogId") REFERENCES "equipment_type_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "customer_sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "service_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assignedTechnicianId_fkey" FOREIGN KEY ("assignedTechnicianId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_inspection_items" ADD CONSTRAINT "work_order_inspection_items_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_inspection_items" ADD CONSTRAINT "work_order_inspection_items_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_shopItemId_fkey" FOREIGN KEY ("shopItemId") REFERENCES "shop_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "tax_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_line_items" ADD CONSTRAINT "estimate_line_items_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_line_items" ADD CONSTRAINT "estimate_line_items_shopItemId_fkey" FOREIGN KEY ("shopItemId") REFERENCES "shop_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_line_items" ADD CONSTRAINT "estimate_line_items_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "tax_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_line_items" ADD CONSTRAINT "credit_note_line_items_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "credit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_line_items" ADD CONSTRAINT "credit_note_line_items_shopItemId_fkey" FOREIGN KEY ("shopItemId") REFERENCES "shop_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_line_items" ADD CONSTRAINT "credit_note_line_items_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "tax_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
