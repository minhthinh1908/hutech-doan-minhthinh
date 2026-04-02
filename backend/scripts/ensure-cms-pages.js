/**
 * Tạo 3 dòng mặc định cho cms_pages (sau khi đã có bảng — prisma db push / migrate).
 *   node scripts/ensure-cms-pages.js
 */
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const DEFAULT_BODY =
    "<p>Nội dung trang đang được cập nhật. Vui lòng quay lại sau hoặc liên hệ hotline.</p>";

const PAGES = [
    { slug: "gioi-thieu", title: "Giới thiệu" },
    { slug: "dich-vu", title: "Dịch vụ" },
    { slug: "tin-tuc", title: "Tin tức" }
];

async function main() {
    for (const p of PAGES) {
        await prisma.cmsPage.upsert({
            where: { slug: p.slug },
            create: { ...p, body_html: DEFAULT_BODY },
            update: {}
        });
        console.log(`[ensure-cms-pages] OK: ${p.slug}`);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
