-- AlterTable
ALTER TABLE "orders" ADD COLUMN "preferred_payment_method" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN "gateway_checkout_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "payments_gateway_checkout_token_key" ON "payments"("gateway_checkout_token");
