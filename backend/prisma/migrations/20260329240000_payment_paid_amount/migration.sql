-- AlterTable
ALTER TABLE "payments" ADD COLUMN "paid_amount" DECIMAL(10,2);

-- Gán số tiền đã thu cho bản ghi đã hoàn tất (đồng bộ với tổng đơn)
UPDATE "payments" AS p
SET "paid_amount" = o."total_amount"
FROM "orders" AS o
WHERE p."order_id" = o."order_id"
  AND p."payment_status" IN ('success', 'paid')
  AND p."paid_at" IS NOT NULL;
