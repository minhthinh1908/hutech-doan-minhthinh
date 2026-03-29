const { PARENTS, SUBS } = require("../data/defaultCategoryCatalog");

/**
 * Tạo thiếu các danh mục theo catalog mẫu (không xóa dữ liệu hiện có).
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {{ onlyIfDbEmpty?: boolean }} opts
 */
async function ensureDefaultCategories(prisma, { onlyIfDbEmpty = false } = {}) {
  if (onlyIfDbEmpty) {
    const n = await prisma.category.count();
    if (n > 0) {
      return { skipped: true, parentsEnsured: 0, childrenCreated: 0 };
    }
  }

  let parentsEnsured = 0;
  let childrenCreated = 0;

  for (let i = 0; i < PARENTS.length; i++) {
    let parent = await prisma.category.findFirst({
      where: { parent_id: null, category_name: PARENTS[i] }
    });
    if (!parent) {
      parent = await prisma.category.create({
        data: { category_name: PARENTS[i], sort_order: i }
      });
      parentsEnsured++;
    } else if ((parent.sort_order ?? 0) !== i) {
      await prisma.category.update({
        where: { category_id: parent.category_id },
        data: { sort_order: i }
      });
    }

    for (let j = 0; j < SUBS[i].length; j++) {
      const childName = SUBS[i][j];
      const existing = await prisma.category.findFirst({
        where: {
          parent_id: parent.category_id,
          category_name: childName
        }
      });
      if (!existing) {
        await prisma.category.create({
          data: {
            category_name: childName,
            parent_id: parent.category_id,
            sort_order: j
          }
        });
        childrenCreated++;
      }
    }
  }

  return { skipped: false, parentsEnsured, childrenCreated };
}

module.exports = { ensureDefaultCategories };
