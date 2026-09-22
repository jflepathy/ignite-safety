-- CreateTable: admin-only audit trail of claims/assignments/status changes
-- on a Work Order (Session 12).
CREATE TABLE "work_order_history" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "byUserId" TEXT,
    "byUserName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "work_order_history_workOrderId_idx" ON "work_order_history"("workOrderId");

ALTER TABLE "work_order_history" ADD CONSTRAINT "work_order_history_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
