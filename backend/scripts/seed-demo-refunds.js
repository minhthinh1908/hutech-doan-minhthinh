/**
 * Chỉ tạo dữ liệu mẫu Admin → Hoàn tiền (không chạy full seed).
 *
 *   cd backend
 *   npm run seed:demo-refunds
 */
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { seedDemoRefundRequests } = require("../services/seedDemoRefundRequests");

const prisma = new PrismaClient();

seedDemoRefundRequests(prisma)
  .then((r) => {
    if (r.skipped && r.error === "no_demo_buyer") {
      console.error("\n→ Chạy trước: npx prisma db seed  (để tạo demo-buyer@ecommercetools.local)\n");
      process.exitCode = 1;
    }
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
