const prisma = require("../prisma/client");
const { ensureDefaultBrands } = require("../services/ensureDefaultBrands");
const { ensureDefaultCategories } = require("../services/ensureDefaultCategories");
const { ensureDefaultCategoryBrands } = require("../services/ensureDefaultCategoryBrands");

function serialize(c) {
    return {
        ...c,
        category_id: c.category_id.toString(),
        parent_id: c.parent_id != null ? c.parent_id.toString() : null
    };
}

async function list(req, res) {
    const categories = await prisma.category.findMany({
        orderBy: [{ sort_order: "asc" }, { category_name: "asc" }]
    });
    res.json(categories.map(serialize));
}

/** Cây danh mục: chỉ cấp 1 (cha) + cấp 2 (con) — dùng mega menu */
async function tree(req, res) {
    const roots = await prisma.category.findMany({
        where: { parent_id: null },
        orderBy: [{ sort_order: "asc" }, { category_name: "asc" }],
        include: {
            children: {
                orderBy: [{ sort_order: "asc" }, { category_name: "asc" }]
            }
        }
    });
    res.json(
        roots.map((r) => ({
            ...serialize(r),
            children: r.children.map((ch) => serialize(ch))
        }))
    );
}

async function getById(req, res) {
    const id = BigInt(req.params.id);
    const category = await prisma.category.findUnique({
        where: { category_id: id }
    });
    if (!category) return res.status(404).json({ message: "Category not found" });
    return res.json(serialize(category));
}

async function validateParent(parent_id) {
    if (parent_id == null || parent_id === "") return null;
    const pid = BigInt(parent_id);
    const p = await prisma.category.findUnique({ where: { category_id: pid } });
    if (!p) {
        const err = new Error("Danh mục cha không tồn tại");
        err.statusCode = 400;
        throw err;
    }
    if (p.parent_id != null) {
        const err = new Error("Chỉ hỗ trợ 2 cấp: chọn cha là danh mục gốc (không có cha).");
        err.statusCode = 400;
        throw err;
    }
    return pid;
}

async function create(req, res) {
    const { category_name, description, parent_id, sort_order } = req.body;
    if (!category_name) return res.status(400).json({ message: "category_name is required" });
    let parentBig = null;
    try {
        parentBig = await validateParent(parent_id);
    } catch (e) {
        return res.status(e.statusCode || 400).json({ message: e.message });
    }

    const category = await prisma.category.create({
        data: {
            category_name,
            description: description || null,
            parent_id: parentBig,
            sort_order: sort_order != null && sort_order !== "" ? Number(sort_order) || 0 : 0
        }
    });
    return res.status(201).json(serialize(category));
}

async function update(req, res) {
    const id = BigInt(req.params.id);
    const existing = await prisma.category.findUnique({ where: { category_id: id } });
    if (!existing) return res.status(404).json({ message: "Category not found" });

    const { category_name, description, parent_id, sort_order } = req.body;
    const data = {};

    if (category_name != null) data.category_name = category_name;
    if (description !== undefined) data.description = description;
    if (sort_order !== undefined) data.sort_order = Number(sort_order) || 0;

    if (parent_id !== undefined) {
        if (parent_id === null || parent_id === "") {
            data.parent_id = null;
        } else {
            if (String(parent_id) === String(id)) {
                return res.status(400).json({ message: "Không thể đặt chính mình làm cha" });
            }
            try {
                data.parent_id = await validateParent(parent_id);
            } catch (e) {
                return res.status(e.statusCode || 400).json({ message: e.message });
            }
        }
    }

    const category = await prisma.category.update({
        where: { category_id: id },
        data
    });
    return res.json(serialize(category));
}

async function seedDefaults(req, res) {
    const b = await ensureDefaultBrands(prisma);
    const r = await ensureDefaultCategories(prisma, { onlyIfDbEmpty: false });
    const br = await ensureDefaultCategoryBrands(prisma);
    const msg = `Đã đồng bộ: +${b.created} thương hiệu (nếu thiếu); +${r.parentsEnsured} nhóm gốc, +${r.childrenCreated} danh mục con; +${br.linksCreated} liên kết nhóm↔hãng.`;
    return res.json({
        brands_created: b.created,
        parents_created: r.parentsEnsured,
        children_created: r.childrenCreated,
        brand_links_created: br.linksCreated,
        message: msg
    });
}

async function reorder(req, res) {
    const roots = Array.isArray(req.body?.roots) ? req.body.roots : null;
    if (!roots) {
        return res.status(400).json({ message: "Payload không hợp lệ: cần roots[]" });
    }

    const rootIds = [];
    const childIds = [];
    const updates = [];

    for (let rootIndex = 0; rootIndex < roots.length; rootIndex += 1) {
        const root = roots[rootIndex] || {};
        if (root.id == null) return res.status(400).json({ message: "Thiếu id danh mục gốc." });
        const rootId = String(root.id);
        if (rootIds.includes(rootId)) {
            return res.status(400).json({ message: "Danh mục gốc bị trùng trong payload." });
        }
        rootIds.push(rootId);
        updates.push({
            category_id: BigInt(rootId),
            parent_id: null,
            sort_order: rootIndex
        });

        const children = Array.isArray(root.children) ? root.children : [];
        for (let childIndex = 0; childIndex < children.length; childIndex += 1) {
            const childRaw = children[childIndex];
            const childId = String(childRaw);
            if (childIds.includes(childId) || rootIds.includes(childId)) {
                return res.status(400).json({ message: "Danh mục con bị trùng trong payload." });
            }
            childIds.push(childId);
            updates.push({
                category_id: BigInt(childId),
                parent_id: BigInt(rootId),
                sort_order: childIndex
            });
        }
    }

    const allIds = [...rootIds, ...childIds].map((id) => BigInt(id));
    const existing = await prisma.category.findMany({
        where: { category_id: { in: allIds } },
        select: { category_id: true }
    });
    if (existing.length !== allIds.length) {
        return res.status(400).json({ message: "Payload chứa danh mục không tồn tại." });
    }

    await prisma.$transaction(
        updates.map((u) =>
            prisma.category.update({
                where: { category_id: u.category_id },
                data: {
                    parent_id: u.parent_id,
                    sort_order: u.sort_order
                }
            })
        )
    );

    return res.json({
        message: "Đã lưu thứ tự danh mục.",
        roots_updated: rootIds.length,
        children_updated: childIds.length
    });
}

async function remove(req, res) {
    const id = BigInt(req.params.id);
    const existing = await prisma.category.findUnique({ where: { category_id: id } });
    if (!existing) return res.status(404).json({ message: "Category not found" });

    const childCount = await prisma.category.count({ where: { parent_id: id } });
    if (childCount > 0) {
        return res.status(400).json({
            message: "Danh mục còn danh mục con — xóa hoặc chuyển con trước."
        });
    }

    const productCount = await prisma.product.count({ where: { category_id: id } });
    if (productCount > 0) {
        return res.status(400).json({
            message: "Danh mục đang có sản phẩm — gỡ hoặc chuyển sản phẩm trước."
        });
    }

    await prisma.category.delete({ where: { category_id: id } });
    return res.json({ message: "Category deleted" });
}

module.exports = { list, tree, getById, seedDefaults, create, update, reorder, remove };
