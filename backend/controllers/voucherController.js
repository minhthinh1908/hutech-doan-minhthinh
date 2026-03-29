const prisma = require("../prisma/client");
const { validateVoucherSync } = require("../services/voucherValidation");

async function list(req, res) {
    const vouchers = await prisma.voucher.findMany({ orderBy: { voucher_id: "desc" } });
    return res.json(
        vouchers.map((v) => ({
            ...v,
            voucher_id: v.voucher_id.toString()
        }))
    );
}

async function getByCode(req, res) {
    const code = String(req.params.code);
    const voucher = await prisma.voucher.findUnique({ where: { code } });
    if (!voucher) return res.status(404).json({ message: "Voucher not found" });
    return res.json({ ...voucher, voucher_id: voucher.voucher_id.toString() });
}

async function create(req, res) {
    const {
        code,
        discount_type,
        discount_value,
        min_order_value,
        max_discount_amount,
        start_date,
        end_date,
        status,
        usage_limit,
        per_user_limit,
        applicable_category_ids
    } = req.body;

    if (!code || !discount_type || discount_value == null || !start_date || !end_date) {
        return res.status(400).json({
            message:
                "code, discount_type, discount_value, start_date, end_date are required"
        });
    }

    const voucher = await prisma.voucher.create({
        data: {
            code: String(code).trim(),
            discount_type,
            discount_value,
            min_order_value: min_order_value ?? 0,
            max_discount_amount: max_discount_amount ?? null,
            start_date: new Date(start_date),
            end_date: new Date(end_date),
            status: status || "active",
            usage_limit: usage_limit != null ? parseInt(usage_limit, 10) : null,
            per_user_limit: per_user_limit != null ? parseInt(per_user_limit, 10) : null,
            applicable_category_ids:
                applicable_category_ids !== undefined ? applicable_category_ids : undefined
        }
    });
    return res.status(201).json({ ...voucher, voucher_id: voucher.voucher_id.toString() });
}

async function update(req, res) {
    const id = BigInt(req.params.id);
    const existing = await prisma.voucher.findUnique({ where: { voucher_id: id } });
    if (!existing) return res.status(404).json({ message: "Voucher not found" });

    const data = {};
    const fields = [
        "code",
        "discount_type",
        "discount_value",
        "min_order_value",
        "max_discount_amount",
        "status",
        "usage_limit",
        "per_user_limit",
        "applicable_category_ids"
    ];
    for (const f of fields) {
        if (req.body[f] !== undefined) data[f] = req.body[f];
    }
    if (req.body.start_date !== undefined) data.start_date = new Date(req.body.start_date);
    if (req.body.end_date !== undefined) data.end_date = new Date(req.body.end_date);
    if (req.body.usage_limit !== undefined) {
        data.usage_limit = req.body.usage_limit === null ? null : parseInt(req.body.usage_limit, 10);
    }
    if (req.body.per_user_limit !== undefined) {
        data.per_user_limit =
            req.body.per_user_limit === null ? null : parseInt(req.body.per_user_limit, 10);
    }

    const voucher = await prisma.voucher.update({ where: { voucher_id: id }, data });
    return res.json({ ...voucher, voucher_id: voucher.voucher_id.toString() });
}

async function remove(req, res) {
    const id = BigInt(req.params.id);
    const existing = await prisma.voucher.findUnique({ where: { voucher_id: id } });
    if (!existing) return res.status(404).json({ message: "Voucher not found" });
    await prisma.voucher.delete({ where: { voucher_id: id } });
    return res.json({ message: "Voucher deleted" });
}

/**
 * Xem trước giảm giá theo giỏ hàng hiện tại (buyer đã đăng nhập).
 */
async function preview(req, res) {
    const user_id = BigInt(req.user.user_id);
    const code = String(req.body?.voucher_code || "").trim();
    if (!code) {
        return res.status(400).json({ message: "voucher_code is required" });
    }

    const cart = await prisma.cart.findUnique({
        where: { user_id },
        include: { cart_items: { include: { product: true } } }
    });
    if (!cart || cart.cart_items.length === 0) {
        return res.status(400).json({ message: "Giỏ hàng trống" });
    }

    const voucher = await prisma.voucher.findUnique({ where: { code } });
    const vCheck = validateVoucherSync(voucher, cart.cart_items);
    if (!vCheck.ok) {
        return res.status(400).json({ message: vCheck.message || "Không áp dụng được mã" });
    }

    if (voucher.per_user_limit != null) {
        const usedByUser = await prisma.orderVoucher.count({
            where: {
                voucher_id: voucher.voucher_id,
                order: { user_id }
            }
        });
        if (usedByUser >= voucher.per_user_limit) {
            return res.status(400).json({
                message: "Bạn đã dùng hết lượt áp dụng mã này"
            });
        }
    }

    const subtotal = cart.cart_items.reduce(
        (s, i) => s + Number(i.unit_price) * i.quantity,
        0
    );
    const discount_amount = vCheck.discount_amount;
    const total = subtotal - discount_amount;

    return res.json({
        voucher_code: code,
        subtotal,
        discount_amount,
        total_amount: total,
        eligible_subtotal: vCheck.eligible_subtotal
    });
}

module.exports = { list, getByCode, create, update, remove, preview };

