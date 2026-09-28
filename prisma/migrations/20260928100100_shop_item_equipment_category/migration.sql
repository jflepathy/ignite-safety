-- Session 22, round 14: tag specific catalog SKUs as trackable safety
-- equipment (vs. accessories, parts, or servicing labor lines). Selling a
-- line item with this set creates an Equipment record for the customer,
-- feeding the existing Outreach "Due Soon" servicing radar -- see
-- src/lib/equipment-from-sale.ts.
ALTER TABLE "shop_items" ADD COLUMN "equipmentCategory" "EquipmentCategory";
