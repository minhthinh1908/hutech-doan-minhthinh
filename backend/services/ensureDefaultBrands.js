const { brandNameToHomeSlug } = require("./brandSlugNode");

/** 5 thương hiệu mặc định (khớp menu + ảnh mẫu) — tạo nếu chưa có hãng cùng slug */
const WANT = [
  { name: "Milwaukee", slug: "milwaukee" },
  { name: "DEWALT", slug: "dewalt" },
  { name: "STANLEY", slug: "stanley" },
  { name: "Amaxtools", slug: "amax" },
  { name: "WORX", slug: "worx" }
];

/**
 * @param {import("@prisma/client").PrismaClient} prisma
 */
async function ensureDefaultBrands(prisma) {
  const all = await prisma.brand.findMany();
  const have = new Set(
    all.map((b) => brandNameToHomeSlug(b.brand_name)).filter(Boolean)
  );
  let created = 0;
  for (const w of WANT) {
    if (have.has(w.slug)) continue;
    await prisma.brand.create({
      data: { brand_name: w.name }
    });
    have.add(w.slug);
    created++;
  }
  return { created };
}

module.exports = { ensureDefaultBrands, WANT };
