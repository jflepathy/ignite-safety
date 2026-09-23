-- Extra technicians on a Work Order beyond the primary assignedTechnicianId
-- (Session 20) -- lets an admin put more than one tech on a job; the
-- incentive earned is split equally across everyone on it.
CREATE TABLE "work_order_technicians" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_technicians_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "work_order_technicians_workOrderId_technicianId_key" ON "work_order_technicians"("workOrderId", "technicianId");

ALTER TABLE "work_order_technicians" ADD CONSTRAINT "work_order_technicians_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "work_order_technicians" ADD CONSTRAINT "work_order_technicians_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
