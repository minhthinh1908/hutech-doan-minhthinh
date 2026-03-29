-- Bổ sung meta thanh toán: gateway, thời gian, phản hồi cổng, hoàn tiền, tiền tệ

ALTER TABLE "payments" ADD COLUMN "payment_gateway" TEXT;
ALTER TABLE "payments" ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "payments" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "payments" ADD COLUMN "gateway_response" JSONB;
ALTER TABLE "payments" ADD COLUMN "failure_reason" TEXT;
ALTER TABLE "payments" ADD COLUMN "currency" TEXT DEFAULT 'VND';
ALTER TABLE "payments" ADD COLUMN "refund_amount" DECIMAL(10,2);

UPDATE "payments" SET "currency" = 'VND' WHERE "currency" IS NULL;
UPDATE "payments" SET "updated_at" = COALESCE("paid_at", "created_at");
