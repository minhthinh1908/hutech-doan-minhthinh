-- Chuẩn hóa giá trị cũ → bộ trạng thái mới (pending | processing | paid | failed | cancelled | refunded)
UPDATE "orders" SET "payment_status" = 'pending' WHERE "payment_status" IN ('unpaid', '');
UPDATE "orders" SET "payment_status" = 'paid' WHERE "payment_status" IN ('success');
UPDATE "orders" SET "payment_status" = 'processing' WHERE "payment_status" IN ('pending_confirmation');

UPDATE "payments" SET "payment_status" = 'paid' WHERE "payment_status" IN ('success');
UPDATE "payments" SET "payment_status" = 'processing' WHERE "payment_status" IN ('awaiting_confirmation');
UPDATE "payments" SET "payment_status" = 'pending' WHERE "payment_status" IN ('unpaid', '');

-- CreateTable
CREATE TABLE "payment_status_logs" (
    "log_id" BIGSERIAL NOT NULL,
    "order_id" BIGINT NOT NULL,
    "payment_id" BIGINT,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'system',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_status_logs_pkey" PRIMARY KEY ("log_id")
);

CREATE INDEX "payment_status_logs_order_id_idx" ON "payment_status_logs"("order_id");
CREATE INDEX "payment_status_logs_created_at_idx" ON "payment_status_logs"("created_at");

ALTER TABLE "payment_status_logs" ADD CONSTRAINT "payment_status_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("order_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_status_logs" ADD CONSTRAINT "payment_status_logs_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("payment_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "orders" ALTER COLUMN "payment_status" SET DEFAULT 'pending';

-- Snapshot lịch sử sau khi chuẩn hóa (một dòng / đơn và / giao dịch)
INSERT INTO "payment_status_logs" ("order_id", "payment_id", "from_status", "to_status", "source", "note")
SELECT "order_id", NULL, NULL, "payment_status", 'system', 'Chuẩn hóa dữ liệu (migration)'
FROM "orders";

INSERT INTO "payment_status_logs" ("order_id", "payment_id", "from_status", "to_status", "source", "note")
SELECT "order_id", "payment_id", NULL, "payment_status", 'system', 'Chuẩn hóa dữ liệu (migration)'
FROM "payments";
