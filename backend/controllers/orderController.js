const prisma = require("../prisma/client");
const { validateVoucherSync } = require("../services/voucherValidation");

function asBigIntString(v) {
    return typeof v === "bigint" ? v.toString() : v;
}

async function listMyOrders(req, res) {
    const user_id = BigInt(req.user.user_id);
    const orders = await prisma.order.findMany({
        where: { user_id },
        include: {
            order_items: { include: { product: true } },
            payments: true,
            order_vouchers: { include: { voucher: true } }
        },
        orderBy: { order_id: "desc" }
    });
    return res.json(
        orders.map((o) => ({
            ...o,
            order_id: asBigIntString(o.order_id),
            user_id: asBigIntString(o.user_id),
            order_items: o.order_items.map((i) => ({
                ...i,
                order_item_id: asBigIntString(i.order_item_id),
                order_id: asBigIntString(i.order_id),
                product_id: asBigIntString(i.product_id),
                product: i.product
                    ? {
                          ...i.product,
                          product_id: asBigIntString(i.product.product_id),
                          category_id: asBigIntString(i.product.category_id),
                          brand_id: asBigIntString(i.product.brand_id)
                      }
                    : null
            })),
            payments: o.payments.map((p) => ({
                ...p,
                payment_id: asBigIntString(p.payment_id),
                order_id: asBigIntString(p.order_id)
            })),
            order_vouchers: o.order_vouchers.map((ov) => ({
                ...ov,
                order_voucher_id: asBigIntString(ov.order_voucher_id),
                order_id: asBigIntString(ov.order_id),
                voucher_id: asBigIntString(ov.voucher_id),
                voucher: ov.voucher
                    ? { ...ov.voucher, voucher_id: asBigIntString(ov.voucher.voucher_id) }
                    : null
            }))
        }))
    );
}

async function getMyOrder(req, res) {
    const user_id = BigInt(req.user.user_id);
    const order_id = BigInt(req.params.id);
    const order = await prisma.order.findFirst({
        where: { order_id, user_id },
        include: {
            order_items: { include: { product: true, warranties: true } },
            payments: true,
            order_vouchers: { include: { voucher: true } },
            refund_requests: true
        }
    });
    if (!order) return res.status(404).json({ message: "Order not found" });
    return res.json(
        JSON.parse(
            JSON.stringify(order, (_, v) => (typeof v === "bigint" ? v.toString() : v))
        )
    );
}

async function checkout(req, res) {
    const user_id = BigInt(req.user.user_id);
    const { voucher_code, shipping_address } = req.body;
    const addr = shipping_address != null ? String(shipping_address).trim() : "";
    if (!addr) {
        return res.status(400).json({ message: "Vui lòng nhập địa chỉ giao hàng." });
    }

    const cart = await prisma.cart.findUnique({
        where: { user_id },
        include: { cart_items: { include: { product: true } } }
    });
    if (!cart || cart.cart_items.length === 0) {
        return res.status(400).json({ message: "Giỏ hàng trống" });
    }

    for (const item of cart.cart_items) {
        if (!item.product) return res.status(400).json({ message: "Dòng giỏ hàng không hợp lệ" });
        if (item.product.status !== "active") {
            return res.status(400).json({
                message:
                    "Giỏ hàng có sản phẩm đã ngừng kinh doanh — vui lòng xóa dòng đó rồi đặt hàng lại"
            });
        }
        if (item.product.stock_quantity < item.quantity) {
            return res.status(400).json({ message: "Một số sản phẩm không đủ tồn kho" });
        }
    }

    const subtotal = cart.cart_items.reduce(
        (sum, i) => sum + Number(i.unit_price) * i.quantity,
        0
    );

    const voucher = voucher_code
        ? await prisma.voucher.findUnique({ where: { code: String(voucher_code).trim() } })
        : null;

    let discount_amount = 0;
    if (voucher_code) {
        if (!voucher) {
            return res.status(400).json({ message: "Mã voucher không tồn tại" });
        }
        let usedByUserCount = 0;
        if (voucher.per_user_limit != null) {
            usedByUserCount = await prisma.orderVoucher.count({
                where: {
                    voucher_id: voucher.voucher_id,
                    order: { user_id }
                }
            });
        }
        const vCheck = validateVoucherSync(voucher, cart.cart_items, { usedByUserCount });
        if (!vCheck.ok) {
            return res.status(400).json({ message: vCheck.message || "Không áp dụng được voucher" });
        }
        discount_amount = vCheck.discount_amount;
    }

    const total_amount = subtotal - discount_amount;

    const order = await prisma.$transaction(async (tx) => {
        const createdOrder = await tx.order.create({
            data: {
                user_id,
                subtotal,
                discount_amount,
                total_amount,
                order_status: "pending",
                payment_status: "unpaid",
                shipping_address: addr
            }
        });

        for (const item of cart.cart_items) {
            const line_total = Number(item.unit_price) * item.quantity;
            const createdItem = await tx.orderItem.create({
                data: {
                    order_id: createdOrder.order_id,
                    product_id: item.product_id,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    line_total
                }
            });

            // decrement stock
            await tx.product.update({
                where: { product_id: item.product_id },
                data: { stock_quantity: { decrement: item.quantity } }
            });

            // Phiếu BH: chờ khách kích hoạt sau khi nhận hàng (đơn hoàn thành/giao)
            const months = item.product.warranty_months || 0;
            if (months > 0) {
                await tx.warranty.create({
                    data: {
                        order_item_id: createdItem.order_item_id,
                        user_id,
                        start_date: null,
                        end_date: null,
                        status: "pending",
                        warranty_months_snapshot: months
                    }
                });
            }
        }

        if (voucher && discount_amount > 0) {
            await tx.orderVoucher.create({
                data: {
                    order_id: createdOrder.order_id,
                    voucher_id: voucher.voucher_id,
                    discount_amount
                }
            });
            await tx.voucher.update({
                where: { voucher_id: voucher.voucher_id },
                data: { usage_count: { increment: 1 } }
            });
        }

        await tx.cartItem.deleteMany({ where: { cart_id: cart.cart_id } });

        return createdOrder;
    });

    return res.status(201).json({
        ...order,
        order_id: order.order_id.toString(),
        user_id: order.user_id.toString()
    });
}

async function createPayment(req, res) {
    const user_id = BigInt(req.user.user_id);
    const order_id = BigInt(req.params.id);
    const { payment_method } = req.body;
    if (!payment_method) {
        return res.status(400).json({ message: "payment_method is required" });
    }
    const order = await prisma.order.findFirst({ where: { order_id, user_id } });
    if (!order) return res.status(404).json({ message: "Order not found" });

    const payment = await prisma.payment.create({
        data: {
            order_id,
            payment_method,
            payment_status: "pending",
            transaction_code: null,
            paid_at: null
        }
    });
    return res.status(201).json({
        ...payment,
        payment_id: payment.payment_id.toString(),
        order_id: payment.order_id.toString()
    });
}

async function listPayments(req, res) {
    const user_id = BigInt(req.user.user_id);
    const order_id = BigInt(req.params.id);
    const order = await prisma.order.findFirst({ where: { order_id, user_id } });
    if (!order) return res.status(404).json({ message: "Order not found" });
    const payments = await prisma.payment.findMany({
        where: { order_id },
        orderBy: { payment_id: "desc" }
    });
    return res.json(
        payments.map((p) => ({
            ...p,
            payment_id: p.payment_id.toString(),
            order_id: p.order_id.toString()
        }))
    );
}

module.exports = {
    listMyOrders,
    getMyOrder,
    checkout,
    createPayment,
    listPayments
};

