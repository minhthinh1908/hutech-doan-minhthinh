-- AlterTable
ALTER TABLE "payments" ADD COLUMN "error_code" TEXT;
ALTER TABLE "payments" ADD COLUMN "buyer_message" TEXT;
ALTER TABLE "payments" ADD COLUMN "is_abnormal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "payments" ADD COLUMN "idempotency_key" TEXT;

CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");
