-- Cho phép phiếu chờ kích hoạt (chưa có ngày bắt đầu/kết thúc)
ALTER TABLE "warranties" ALTER COLUMN "start_date" DROP NOT NULL;
ALTER TABLE "warranties" ALTER COLUMN "end_date" DROP NOT NULL;

ALTER TABLE "warranties" ADD COLUMN "activated_at" TIMESTAMP(3);
ALTER TABLE "warranties" ADD COLUMN "warranty_months_snapshot" INTEGER NOT NULL DEFAULT 0;

-- Dữ liệu cũ: coi như đã kích hoạt
UPDATE "warranties" w
SET "activated_at" = COALESCE(w."start_date"::timestamp, w."created_at"),
    "warranty_months_snapshot" = COALESCE(p."warranty_months", 0)
FROM "order_items" oi
JOIN "products" p ON p."product_id" = oi."product_id"
WHERE w."order_item_id" = oi."order_item_id"
  AND w."start_date" IS NOT NULL;

UPDATE "warranties"
SET "status" = 'active'
WHERE "start_date" IS NOT NULL AND ("status" IS NULL OR "status" = 'pending');

ALTER TABLE "warranties" ALTER COLUMN "status" SET DEFAULT 'pending';
