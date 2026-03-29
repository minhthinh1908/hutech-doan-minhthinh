const prisma = require("../prisma/client");

/** GET — map nhóm gốc → danh sách brand_id (public, phục vụ menu + trang chủ) */
async function listMap(req, res) {
    const roots = await prisma.category.findMany({
        where: { parent_id: null },
        orderBy: [{ sort_order: "asc" }, { category_name: "asc" }]
    });
    const links = await prisma.categoryBrand.findMany();
    const by_root = {};
    for (const r of roots) {
        by_root[String(r.category_id)] = [];
    }
    for (const l of links) {
        const key = String(l.category_id);
        if (by_root[key] === undefined) by_root[key] = [];
        by_root[key].push(String(l.brand_id));
    }
    const brands = await prisma.brand.findMany({ orderBy: { brand_name: "asc" } });
    res.json({
        by_root,
        brands: brands.map((b) => ({
            ...b,
            brand_id: b.brand_id.toString()
        }))
    });
}

/** PUT — thay toàn bộ liên kết (admin) body: { by_root: { "1": ["1","2"], ... } } chỉ nhóm gốc */
async function setMap(req, res) {
    const { by_root } = req.body;
    if (!by_root || typeof by_root !== "object") {
        return res.status(400).json({ message: "by_root object required" });
    }

    await prisma.$transaction(async (tx) => {
        await tx.categoryBrand.deleteMany({});
        for (const [cidStr, bidList] of Object.entries(by_root)) {
            let rootId;
            try {
                rootId = BigInt(cidStr);
            } catch {
                continue;
            }
            const root = await tx.category.findUnique({ where: { category_id: rootId } });
            if (!root || root.parent_id != null) continue;

            const ids = Array.isArray(bidList) ? bidList : [];
            for (const bidStr of ids) {
                let brandId;
                try {
                    brandId = BigInt(bidStr);
                } catch {
                    continue;
                }
                const brand = await tx.brand.findUnique({ where: { brand_id: brandId } });
                if (!brand) continue;
                await tx.categoryBrand.create({
                    data: {
                        category_id: rootId,
                        brand_id: brandId
                    }
                });
            }
        }
    });

    return res.json({ message: "Đã cập nhật liên kết danh mục — thương hiệu." });
}

module.exports = { listMap, setMap };
