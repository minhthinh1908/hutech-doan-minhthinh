const { brandNameToHomeSlug } = require("./brandSlugNode");

/**
 * Gán 5 thương hiệu chính cho mọi nhóm danh mục gốc (nếu chưa có liên kết).
 * @param {import("@prisma/client").PrismaClient} prisma
 */
async function ensureDefaultCategoryBrands(prisma) {
  const roots = await prisma.category.findMany({
    where: { parent_id: null },
    orderBy: [{ sort_order: "asc" }, { category_name: "asc" }]
  });
  const brands = await prisma.brand.findMany();
  const matched = brands.filter((b) => brandNameToHomeSlug(b.brand_name));
  if (roots.length === 0 || matched.length === 0) {
    return { linksCreated: 0 };
  }
  let linksCreated = 0;
  for (const root of roots) {
    for (const b of matched) {
      const existing = await prisma.categoryBrand.findUnique({
        where: {
          category_id_brand_id: {
            category_id: root.category_id,
            brand_id: b.brand_id
          }
        }
      });
      if (!existing) {
        await prisma.categoryBrand.create({
          data: {
            category_id: root.category_id,
            brand_id: b.brand_id
          }
        });
        linksCreated++;
      }
    }
  }
  return { linksCreated };
}

module.exports = { ensureDefaultCategoryBrands };
