/**
 * Khi migration kẹt, bảng payment_status_logs có thể chưa tồn tại → checkout gọi appendPaymentStatusLog lỗi.
 * Script idempotent — an toàn chạy lại.
 */
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "payment_status_logs" (
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
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "payment_status_logs_order_id_idx" ON "payment_status_logs"("order_id")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "payment_status_logs_created_at_idx" ON "payment_status_logs"("created_at")`
  );

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payment_status_logs_order_id_fkey'
      ) THEN
        ALTER TABLE "payment_status_logs"
          ADD CONSTRAINT "payment_status_logs_order_id_fkey"
          FOREIGN KEY ("order_id") REFERENCES "orders"("order_id")
          ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payment_status_logs_payment_id_fkey'
      ) THEN
        ALTER TABLE "payment_status_logs"
          ADD CONSTRAINT "payment_status_logs_payment_id_fkey"
          FOREIGN KEY ("payment_id") REFERENCES "payments"("payment_id")
          ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$;
  `);

  console.log("[ok] payment_status_logs table + indexes + FKs");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
