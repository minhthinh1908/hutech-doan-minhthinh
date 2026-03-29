/**
 * Bổ sung cột thiếu khi chuỗi migration chưa chạy hết (Neon / DB cũ) — idempotent.
 * orders: preferred_payment_method
 * payments: các cột theo migrations 29240000, 29260000, 29300000, 29310000
 */
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "preferred_payment_method" TEXT`
  );
  console.log("[ok] orders.preferred_payment_method");

  const paymentCols = [
    `ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "paid_amount" DECIMAL(10,2)`,
    `ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "error_code" TEXT`,
    `ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "buyer_message" TEXT`,
    `ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "is_abnormal" BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT`,
    `ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "payment_gateway" TEXT`,
    `ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "gateway_response" JSONB`,
    `ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "failure_reason" TEXT`,
    `ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "currency" TEXT DEFAULT 'VND'`,
    `ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "refund_amount" DECIMAL(10,2)`,
    `ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "gateway_checkout_token" TEXT`
  ];

  for (const sql of paymentCols) {
    await prisma.$executeRawUnsafe(sql);
  }
  console.log("[ok] payments.* columns");

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'payments_idempotency_key_key') THEN
        CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'payments_gateway_checkout_token_key') THEN
        CREATE UNIQUE INDEX "payments_gateway_checkout_token_key" ON "payments"("gateway_checkout_token");
      END IF;
    END $$;
  `);
  console.log("[ok] payments unique indexes (if needed)");

  await prisma.$executeRawUnsafe(
    `UPDATE "payments" SET "currency" = 'VND' WHERE "currency" IS NULL`
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "payments" SET "updated_at" = COALESCE("paid_at", "created_at", CURRENT_TIMESTAMP) WHERE "updated_at" IS NULL`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
