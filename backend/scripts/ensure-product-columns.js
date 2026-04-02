/**
 * Bảng products trong init migration thiếu nhiều cột so với schema hiện tại (ảnh, flash sale, nổi bật…).
 * Nếu chưa có migration tương ứng, Prisma update sẽ lỗi P2022.
 */
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const alters = [
    `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "image_url" TEXT`,
    `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "old_price" DECIMAL(10,2)`,
    `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "is_hot" BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "is_bestseller" BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "is_new" BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "contact_only" BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "is_flash_sale" BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "flash_sale_price" DECIMAL(10,2)`,
    `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "flash_sale_start" TIMESTAMP(3)`,
    `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "flash_sale_end" TIMESTAMP(3)`,
    `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "is_featured" BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "featured_banner_title" TEXT`,
    `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "featured_banner_subtitle" TEXT`,
    `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "featured_label_1" TEXT`,
    `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "featured_label_2" TEXT`,
    `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "featured_side_image_url" TEXT`
];

async function main() {
    for (const sql of alters) {
        await prisma.$executeRawUnsafe(sql);
    }
    console.log("[ok] products: extended columns (if any were missing)");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
