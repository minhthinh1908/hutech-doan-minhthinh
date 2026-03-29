const prisma = require("../prisma/client");
const { ensureDefaultBrands } = require("../services/ensureDefaultBrands");

async function list(req, res) {
    let brands = await prisma.brand.findMany({ orderBy: { brand_name: "asc" } });
    if (brands.length === 0) {
        await ensureDefaultBrands(prisma);
        brands = await prisma.brand.findMany({ orderBy: { brand_name: "asc" } });
    }
    res.json(
        brands.map((b) => ({
            ...b,
            brand_id: b.brand_id.toString()
        }))
    );
}

async function getById(req, res) {
    const id = BigInt(req.params.id);
    const brand = await prisma.brand.findUnique({ where: { brand_id: id } });
    if (!brand) return res.status(404).json({ message: "Brand not found" });
    return res.json({ ...brand, brand_id: brand.brand_id.toString() });
}

async function create(req, res) {
    const { brand_name, description } = req.body;
    if (!brand_name) return res.status(400).json({ message: "brand_name is required" });
    const brand = await prisma.brand.create({
        data: { brand_name, description: description || null }
    });
    return res.status(201).json({ ...brand, brand_id: brand.brand_id.toString() });
}

async function update(req, res) {
    const id = BigInt(req.params.id);
    const { brand_name, description } = req.body;
    const existing = await prisma.brand.findUnique({ where: { brand_id: id } });
    if (!existing) return res.status(404).json({ message: "Brand not found" });
    const brand = await prisma.brand.update({
        where: { brand_id: id },
        data: {
            ...(brand_name != null ? { brand_name } : {}),
            ...(description !== undefined ? { description } : {})
        }
    });
    return res.json({ ...brand, brand_id: brand.brand_id.toString() });
}

async function seedDefaults(req, res) {
    const r = await ensureDefaultBrands(prisma);
    const brands = await prisma.brand.findMany({ orderBy: { brand_name: "asc" } });
    return res.json({
        created: r.created,
        brands: brands.map((b) => ({ ...b, brand_id: b.brand_id.toString() })),
        message:
            r.created > 0
                ? `Đã thêm ${r.created} thương hiệu mặc định (Milwaukee, DEWALT, STANLEY, Amaxtools, WORX).`
                : "Đủ 5 thương hiệu — không thêm dòng mới."
    });
}

async function remove(req, res) {
    const id = BigInt(req.params.id);
    const existing = await prisma.brand.findUnique({ where: { brand_id: id } });
    if (!existing) return res.status(404).json({ message: "Brand not found" });
    const productCount = await prisma.product.count({ where: { brand_id: id } });
    if (productCount > 0) {
        return res.status(400).json({
            message: `Không xóa được: còn ${productCount} sản phẩm đang gán thương hiệu này. Sửa hoặc xóa các sản phẩm đó trước (Admin → Sản phẩm).`
        });
    }
    await prisma.brand.delete({ where: { brand_id: id } });
    return res.json({ message: "Đã xóa thương hiệu. Liên kết danh mục đã gỡ (nếu có)." });
}

module.exports = { list, getById, seedDefaults, create, update, remove };

