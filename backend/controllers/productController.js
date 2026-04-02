const prisma = require("../prisma/client");
const { parsePagination } = require("../utils/pagination");

function toNumber(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function toBool(value, fallback = false) {
    if (value === true || value === "true") return true;
    if (value === false || value === "false") return false;
    return fallback;
}

function toOptionalDecimal(value) {
    if (value == null || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function toOptionalDate(value) {
    if (value == null || value === "") return null;
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
}

const productInclude = {
    category: { include: { parent: true } },
    brand: true
};

function serializeCategoryWithParent(c) {
    if (!c) return null;
    return {
        category_id: c.category_id.toString(),
        parent_id: c.parent_id != null ? c.parent_id.toString() : null,
        category_name: c.category_name,
        description: c.description,
        sort_order: c.sort_order,
        parent: c.parent
            ? {
                  category_id: c.parent.category_id.toString(),
                  parent_id:
                      c.parent.parent_id != null ? c.parent.parent_id.toString() : null,
                  category_name: c.parent.category_name,
                  description: c.parent.description,
                  sort_order: c.parent.sort_order
              }
            : null
    };
}

function serializeProduct(p) {
    const { category, brand, ...rest } = p;
    return {
        ...rest,
        product_id: p.product_id.toString(),
        category_id: p.category_id.toString(),
        brand_id: p.brand_id.toString(),
        price: rest.price != null ? Number(rest.price) : null,
        old_price: rest.old_price != null ? Number(rest.old_price) : null,
        flash_sale_price: rest.flash_sale_price != null ? Number(rest.flash_sale_price) : null,
        category: serializeCategoryWithParent(category),
        brand: brand ? { ...brand, brand_id: brand.brand_id.toString() } : null
    };
}

/** Lọc theo danh mục: nếu là nhóm cha → gồm tất cả sản phẩm thuộc danh mục con */
async function categoryIdsForFilter(categoryIdStr) {
    const id = BigInt(categoryIdStr);
    const cat = await prisma.category.findUnique({
        where: { category_id: id },
        include: { _count: { select: { children: true } } }
    });
    if (!cat) return null;
    if (cat._count.children === 0) return [id];
    const children = await prisma.category.findMany({
        where: { parent_id: id },
        select: { category_id: true }
    });
    if (!children.length) return [id];
    return children.map((c) => c.category_id);
}

/** Sản phẩm chỉ gắn danh mục lá (không chọn nhóm lớn còn có nhóm nhỏ — khớp mega menu) */
async function assertLeafCategory(categoryId) {
    const cat = await prisma.category.findUnique({
        where: { category_id: BigInt(categoryId) },
        include: { _count: { select: { children: true } } }
    });
    if (!cat) {
        const err = new Error("Danh mục không tồn tại");
        err.statusCode = 400;
        throw err;
    }
    if (cat._count.children > 0) {
        const err = new Error(
            "Chọn danh mục con (nhóm nhỏ trong menu), không chọn nhóm lớn đang có danh mục con bên dưới."
        );
        err.statusCode = 400;
        throw err;
    }
}

/** ORDER BY — chỉ chuỗi whitelist, tránh chèn từ client */
function orderByWhitelist(sort) {
    const m = {
        price_asc: "p.price ASC",
        price_desc: "p.price DESC",
        name_asc: "p.product_name ASC",
        name_desc: "p.product_name DESC"
    };
    return m[sort] || "p.product_id DESC";
}

/**
 * Lọc is_bestseller / is_new bằng SQL + tham số $1..$n (PostgreSQL).
 * Tránh Prisma.join / nhiều fragment Sql gây lỗi "syntax error at or near Object".
 */
async function listWithFlagColumns(req, res, ctx) {
    const { page, limit, skip, q, category_id, brand_id, status, min_price, max_price, sort } =
        ctx;
    const { flagBestseller, flagNew } = ctx;

    let resolvedCategoryIds = null;
    if (category_id) {
        resolvedCategoryIds = await categoryIdsForFilter(String(category_id));
        if (resolvedCategoryIds === null) {
            return res.status(404).json({ message: "Category not found" });
        }
    }

    const statusStr = status === "inactive" ? "inactive" : "active";
    const clauses = [];
    const params = [];
    let idx = 1;

    clauses.push(`p.status = $${idx}`);
    params.push(statusStr);
    idx += 1;

    if (flagBestseller) clauses.push("p.is_bestseller = true");
    if (flagNew) clauses.push("p.is_new = true");

    if (resolvedCategoryIds) {
        if (resolvedCategoryIds.length === 1) {
            clauses.push(`p.category_id = $${idx}`);
            params.push(resolvedCategoryIds[0]);
            idx += 1;
        } else {
            const startIdx = idx;
            const ph = resolvedCategoryIds.map((_, i) => `$${startIdx + i}`).join(", ");
            resolvedCategoryIds.forEach((cid) => params.push(cid));
            clauses.push(`p.category_id IN (${ph})`);
            idx += resolvedCategoryIds.length;
        }
    }
    if (brand_id) {
        clauses.push(`p.brand_id = $${idx}`);
        params.push(BigInt(brand_id));
        idx += 1;
    }
    if (q) {
        const pattern = `%${String(q)}%`;
        clauses.push(`(p.product_name ILIKE $${idx} OR p.sku ILIKE $${idx})`);
        params.push(pattern);
        idx += 1;
    }
    if (min_price) {
        clauses.push(`p.price >= $${idx}`);
        params.push(toNumber(min_price, 0));
        idx += 1;
    }
    if (max_price) {
        clauses.push(`p.price <= $${idx}`);
        params.push(toNumber(max_price, 0));
        idx += 1;
    }

    const whereSql = clauses.join(" AND ");
    const sortKey = Array.isArray(sort) ? sort[0] : sort;
    const orderBy = orderByWhitelist(sortKey);

    const countQuery = `SELECT COUNT(*)::bigint AS c FROM products p WHERE ${whereSql}`;
    const countRows = await prisma.$queryRawUnsafe(countQuery, ...params);
    const total = Number(countRows[0]?.c ?? 0);

    const lim = Number(limit);
    const off = Number(skip);
    const limitIdx = idx;
    const offsetIdx = idx + 1;
    const idQuery = `SELECT p.product_id FROM products p WHERE ${whereSql} ORDER BY ${orderBy} LIMIT $${limitIdx} OFFSET $${offsetIdx}`;
    const idRows = await prisma.$queryRawUnsafe(idQuery, ...params, lim, off);

    const ids = idRows.map((r) => r.product_id);
    if (ids.length === 0) {
        return res.json({ page, limit, total, items: [] });
    }

    const itemsUnsorted = await prisma.product.findMany({
        where: { product_id: { in: ids } },
        include: productInclude
    });
    const orderMap = new Map(ids.map((id, i) => [id.toString(), i]));
    itemsUnsorted.sort(
        (a, b) =>
            (orderMap.get(a.product_id.toString()) ?? 0) -
            (orderMap.get(b.product_id.toString()) ?? 0)
    );

    return res.json({
        page,
        limit,
        total,
        items: itemsUnsorted.map(serializeProduct)
    });
}

async function list(req, res) {
    const { page, limit, skip } = parsePagination(req.query);

    const {
        q,
        category_id,
        brand_id,
        status,
        min_price,
        max_price,
        sort,
        is_bestseller,
        is_new
    } = req.query;

    const flagBestseller = is_bestseller === "true";
    const flagNew = is_new === "true";

    if (flagBestseller || flagNew) {
        return listWithFlagColumns(req, res, {
            page,
            limit,
            skip,
            q,
            category_id,
            brand_id,
            status,
            min_price,
            max_price,
            sort,
            flagBestseller,
            flagNew
        });
    }

    let categoryFilter = {};
    if (category_id) {
        const ids = await categoryIdsForFilter(String(category_id));
        if (ids === null) return res.status(404).json({ message: "Category not found" });
        categoryFilter = ids.length === 1 ? { category_id: ids[0] } : { category_id: { in: ids } };
    }

    const where = {
        ...(status ? { status: String(status) } : {}),
        ...(q
            ? {
                  OR: [
                      { product_name: { contains: String(q), mode: "insensitive" } },
                      { sku: { contains: String(q), mode: "insensitive" } }
                  ]
              }
            : {}),
        ...categoryFilter,
        ...(brand_id ? { brand_id: BigInt(brand_id) } : {}),
        ...(min_price || max_price
            ? {
                  price: {
                      ...(min_price ? { gte: toNumber(min_price, 0) } : {}),
                      ...(max_price ? { lte: toNumber(max_price, 0) } : {})
                  }
              }
            : {})
    };

    if (req.query.is_featured === "true") {
        where.is_featured = true;
    }
    if (req.query.flash_sale_active === "true") {
        const now = new Date();
        where.is_flash_sale = true;
        where.flash_sale_price = { not: null };
        const timeClauses = [
            { OR: [{ flash_sale_start: null }, { flash_sale_start: { lte: now } }] },
            { OR: [{ flash_sale_end: null }, { flash_sale_end: { gte: now } }] }
        ];
        where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), ...timeClauses];
    }

    let orderBy = { product_id: "desc" };
    if (sort === "price_asc") orderBy = { price: "asc" };
    if (sort === "price_desc") orderBy = { price: "desc" };
    if (sort === "name_asc") orderBy = { product_name: "asc" };
    if (sort === "name_desc") orderBy = { product_name: "desc" };

    const [items, total] = await Promise.all([
        prisma.product.findMany({
            where,
            include: productInclude,
            orderBy,
            skip,
            take: limit
        }),
        prisma.product.count({ where })
    ]);

    return res.json({
        page,
        limit,
        total,
        items: items.map(serializeProduct)
    });
}

async function getById(req, res) {
    const id = BigInt(req.params.id);
    const product = await prisma.product.findUnique({
        where: { product_id: id },
        include: productInclude
    });
    if (!product) return res.status(404).json({ message: "Product not found" });
    return res.json(serializeProduct(product));
}

async function create(req, res) {
    const {
        category_id,
        brand_id,
        product_name,
        sku,
        price,
        stock_quantity,
        warranty_months,
        description,
        status,
        image_url,
        old_price,
        is_hot,
        is_bestseller,
        is_new,
        contact_only,
        is_flash_sale,
        flash_sale_price,
        flash_sale_start,
        flash_sale_end,
        is_featured,
        featured_banner_title,
        featured_banner_subtitle,
        featured_label_1,
        featured_label_2,
        featured_side_image_url
    } = req.body;

    if (!category_id || !brand_id || !product_name || !sku || price == null) {
        return res.status(400).json({
            message: "category_id, brand_id, product_name, sku, price are required"
        });
    }

    const priceNumCreate = Number(price);
    if (!Number.isFinite(priceNumCreate) || priceNumCreate < 0) {
        return res.status(400).json({ message: "Giá bán không hợp lệ" });
    }

    try {
        await assertLeafCategory(category_id);
    } catch (e) {
        return res.status(e.statusCode || 400).json({ message: e.message });
    }

    const product = await prisma.product.create({
        data: {
            category_id: BigInt(category_id),
            brand_id: BigInt(brand_id),
            product_name,
            sku,
            price: priceNumCreate,
            stock_quantity: stock_quantity ?? 0,
            warranty_months: warranty_months ?? 0,
            description: description || null,
            image_url: image_url ? String(image_url).trim() : null,
            status: status || "active",
            old_price: toOptionalDecimal(old_price),
            is_hot: toBool(is_hot, false),
            is_bestseller: toBool(is_bestseller, false),
            is_new: toBool(is_new, false),
            contact_only: toBool(contact_only, false),
            is_flash_sale: toBool(is_flash_sale, false),
            flash_sale_price: toOptionalDecimal(flash_sale_price),
            flash_sale_start: toOptionalDate(flash_sale_start),
            flash_sale_end: toOptionalDate(flash_sale_end),
            is_featured: toBool(is_featured, false),
            featured_banner_title: featured_banner_title ? String(featured_banner_title).trim() || null : null,
            featured_banner_subtitle: featured_banner_subtitle
                ? String(featured_banner_subtitle).trim() || null
                : null,
            featured_label_1: featured_label_1 ? String(featured_label_1).trim() || null : null,
            featured_label_2: featured_label_2 ? String(featured_label_2).trim() || null : null,
            featured_side_image_url: featured_side_image_url
                ? String(featured_side_image_url).trim() || null
                : null
        }
    });

    const full = await prisma.product.findUnique({
        where: { product_id: product.product_id },
        include: productInclude
    });
    return res.status(201).json(serializeProduct(full));
}

async function update(req, res) {
    const id = BigInt(req.params.id);
    const existing = await prisma.product.findUnique({ where: { product_id: id } });
    if (!existing) return res.status(404).json({ message: "Product not found" });

    const data = {};
    const fields = [
        "product_name",
        "sku",
        "price",
        "stock_quantity",
        "warranty_months",
        "description",
        "status",
        "image_url"
    ];
    for (const f of fields) {
        if (req.body[f] !== undefined && f !== "image_url") data[f] = req.body[f];
    }
    if (req.body.image_url !== undefined) {
        data.image_url =
            req.body.image_url === null || req.body.image_url === ""
                ? null
                : String(req.body.image_url).trim();
    }
    if (req.body.old_price !== undefined) {
        data.old_price = toOptionalDecimal(req.body.old_price);
    }
    if (req.body.is_hot !== undefined) data.is_hot = toBool(req.body.is_hot, false);
    if (req.body.is_bestseller !== undefined) data.is_bestseller = toBool(req.body.is_bestseller, false);
    if (req.body.is_new !== undefined) data.is_new = toBool(req.body.is_new, false);
    if (req.body.contact_only !== undefined) data.contact_only = toBool(req.body.contact_only, false);
    if (req.body.is_flash_sale !== undefined) data.is_flash_sale = toBool(req.body.is_flash_sale, false);
    if (req.body.flash_sale_price !== undefined) data.flash_sale_price = toOptionalDecimal(req.body.flash_sale_price);
    if (req.body.flash_sale_start !== undefined) data.flash_sale_start = toOptionalDate(req.body.flash_sale_start);
    if (req.body.flash_sale_end !== undefined) data.flash_sale_end = toOptionalDate(req.body.flash_sale_end);
    if (req.body.is_featured !== undefined) data.is_featured = toBool(req.body.is_featured, false);
    if (req.body.featured_banner_title !== undefined) {
        data.featured_banner_title =
            req.body.featured_banner_title === null || req.body.featured_banner_title === ""
                ? null
                : String(req.body.featured_banner_title).trim() || null;
    }
    if (req.body.featured_banner_subtitle !== undefined) {
        data.featured_banner_subtitle =
            req.body.featured_banner_subtitle === null || req.body.featured_banner_subtitle === ""
                ? null
                : String(req.body.featured_banner_subtitle).trim() || null;
    }
    if (req.body.featured_label_1 !== undefined) {
        data.featured_label_1 =
            req.body.featured_label_1 === null || req.body.featured_label_1 === ""
                ? null
                : String(req.body.featured_label_1).trim() || null;
    }
    if (req.body.featured_label_2 !== undefined) {
        data.featured_label_2 =
            req.body.featured_label_2 === null || req.body.featured_label_2 === ""
                ? null
                : String(req.body.featured_label_2).trim() || null;
    }
    if (req.body.featured_side_image_url !== undefined) {
        data.featured_side_image_url =
            req.body.featured_side_image_url === null || req.body.featured_side_image_url === ""
                ? null
                : String(req.body.featured_side_image_url).trim() || null;
    }
    if (req.body.category_id !== undefined) {
        const next = BigInt(req.body.category_id);
        if (next !== existing.category_id) {
            try {
                await assertLeafCategory(req.body.category_id);
            } catch (e) {
                return res.status(e.statusCode || 400).json({ message: e.message });
            }
        }
        data.category_id = next;
    }
    if (req.body.brand_id !== undefined) data.brand_id = BigInt(req.body.brand_id);

    if (data.price !== undefined) {
        const n = Number(data.price);
        if (!Number.isFinite(n) || n < 0) {
            return res.status(400).json({ message: "Giá bán không hợp lệ" });
        }
        data.price = n;
    }
    if (data.old_price !== undefined && data.old_price !== null) {
        const n = Number(data.old_price);
        if (!Number.isFinite(n) || n < 0) {
            return res.status(400).json({ message: "Giá niêm yết không hợp lệ" });
        }
        data.old_price = n;
    }

    await prisma.product.update({ where: { product_id: id }, data });
    const full = await prisma.product.findUnique({
        where: { product_id: id },
        include: productInclude
    });
    return res.json(serializeProduct(full));
}

async function remove(req, res) {
    const id = BigInt(req.params.id);
    const existing = await prisma.product.findUnique({ where: { product_id: id } });
    if (!existing) return res.status(404).json({ message: "Product not found" });
    await prisma.product.delete({ where: { product_id: id } });
    return res.json({ message: "Product deleted" });
}

module.exports = { list, getById, create, update, remove };

