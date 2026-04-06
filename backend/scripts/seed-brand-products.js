/**
 * Chỉ seed 2 sản phẩm/thương hiệu (model thật) — không tạo user/voucher.
 *
 *   cd backend
 *   node scripts/seed-brand-products.js
 *
 * Hoặc chạy full: npx prisma db seed
 */
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { ensureDefaultBrands } = require("../services/ensureDefaultBrands");
const { ensureDefaultCategories } = require("../services/ensureDefaultCategories");
const { seedRealProductsPerBrand } = require("../services/seedRealProductsPerBrand");

const prisma = new PrismaClient();

async function main() {
  await ensureDefaultBrands(prisma);
  await ensureDefaultCategories(prisma, { onlyIfDbEmpty: false });
  await seedRealProductsPerBrand(prisma);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
