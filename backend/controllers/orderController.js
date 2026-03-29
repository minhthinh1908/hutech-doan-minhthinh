const crypto = require("crypto");
const prisma = require("../prisma/client");
const { validateVoucherSync } = require("../services/voucherValidation");
const {
    assertBuyerDoesNotSetPaymentStatus,
    assertAllowedPaymentMethod,
    assertCanCreateNewPaymentAttempt
} = require("../services/paymentBusinessRules");
const { applyGatewayPaymentResult, applyGatewayOutcomeByToken } = require("../services/paymentGatewayService");
const { appendPaymentStatusLog } = require("../services/paymentStatusLog");
const { applyPaymentOutcomeScenario } = require("../services/paymentOutcomeService");
const { logPaymentException } = require("../services/paymentExceptionLog");

const PAYMENT_METHODS = new Set(["cod", "bank_transfer", "payment_gateway"]);

function asBigIntString(v) {
    return typeof v === "bigint" ? v.toString() : v;
}

function newGatewayToken() {
    return crypto.randomBytes(24).toString("hex");
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
            payments: o.payments.map((p) => serializePayment(p)),
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
    const safe = {
        ...order,
        payments: (order.payments || []).map((p) => serializePayment(p))
    };
    return res.json(
        JSON.parse(JSON.stringify(safe, (_, v) => (typeof v === "bigint" ? v.toString() : v)))
    );
}

async function checkout(req, res) {
    const user_id = BigInt(req.user.user_id);
    const { voucher_code, shipping_address, payment_method } = req.body;
    const addr = shipping_address != null ? String(shipping_address).trim() : "";
    if (!addr) {
        return res.status(400).json({ message: "Vui lòng nhập địa chỉ giao hàng." });
    }
    const pm = payment_method != null ? String(payment_method).trim() : "";
    if (!PAYMENT_METHODS.has(pm)) {
        return res.status(400).json({
            message: `Chọn phương thức thanh toán: ${[...PAYMENT_METHODS].join(", ")}`
        });
    }
    let orderPaymentStatus = "unpaid";
    if (pm === "bank_transfer" || pm === "payment_gateway") {
        orderPaymentStatus = "pending";
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
                payment_status: orderPaymentStatus,
                preferred_payment_method: pm,
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

        let gatewayCheckoutToken = null;
        if (pm === "payment_gateway") {
            gatewayCheckoutToken = newGatewayToken();
        }

        const asyncFlowCheckout = pm === "payment_gateway" || pm === "bank_transfer";
        const firstPaymentStatus = asyncFlowCheckout ? "processing" : "pending";

        await appendPaymentStatusLog({
            tx,
            order_id: createdOrder.order_id,
            payment_id: null,
            from_status: null,
            to_status: orderPaymentStatus,
            source: "system",
            note: "Đặt hàng — trạng thái thanh toán ban đầu"
        });

        const createdPay = await tx.payment.create({
            data: {
                order_id: createdOrder.order_id,
                payment_method: pm,
                payment_status: firstPaymentStatus,
                payment_gateway: pm === "payment_gateway" ? "demo" : null,
                transaction_code: null,
                paid_at: null,
                gateway_checkout_token: gatewayCheckoutToken,
                currency: "VND"
            }
        });
        await appendPaymentStatusLog({
            tx,
            order_id: createdOrder.order_id,
            payment_id: createdPay.payment_id,
            from_status: null,
            to_status: firstPaymentStatus,
            source: "system",
            note:
                pm === "cod"
                    ? "COD — thanh toán khi nhận hàng"
                    : pm === "bank_transfer"
                      ? "Chuyển khoản — đang xử lý"
                      : "Cổng thanh toán — đang xử lý"
        });

        return {
            createdOrder,
            gateway_checkout_token: gatewayCheckoutToken,
            payment_method: pm
        };
    });

    const oid = order.createdOrder.order_id;
    const body = {
        ...order.createdOrder,
        order_id: oid.toString(),
        user_id: order.createdOrder.user_id.toString(),
        payment_method: order.payment_method
    };
    if (order.payment_method === "payment_gateway" && order.gateway_checkout_token) {
        body.payment_gateway = {
            checkout_token: order.gateway_checkout_token,
            redirect_path: `/thanh-toan?token=${encodeURIComponent(order.gateway_checkout_token)}&orderId=${oid}`,
            message: "Chuyển tới cổng thanh toán (demo) để hoàn tất giao dịch."
        };
    }
    return res.status(201).json(body);
}

function serializePayment(p) {
    if (!p) return p;
    const { gateway_checkout_token: _tok, ...rest } = p;
    return {
        ...rest,
        payment_id: asBigIntString(rest.payment_id),
        order_id: asBigIntString(rest.order_id),
        paid_amount: rest.paid_amount != null ? String(rest.paid_amount) : null,
        refund_amount: rest.refund_amount != null ? String(rest.refund_amount) : null
    };
}

async function createPayment(req, res) {
    const user_id = BigInt(req.user.user_id);
    const order_id = BigInt(req.params.id);
    const { payment_method, currency: bodyCurrency, payment_gateway: bodyGateway } = req.body;

    const denyStatus = assertBuyerDoesNotSetPaymentStatus(req.body);
    if (!denyStatus.ok) {
        return res.status(400).json({ message: denyStatus.message });
    }

    if (!payment_method) {
        return res.status(400).json({ message: "payment_method is required" });
    }
    const pm = String(payment_method).trim().toLowerCase();
    if (!PAYMENT_METHODS.has(pm)) {
        return res.status(400).json({
            message: `payment_method phải là một trong: ${[...PAYMENT_METHODS].join(", ")}`
        });
    }
    const order = await prisma.order.findFirst({ where: { order_id, user_id } });
    if (!order) return res.status(404).json({ message: "Order not found" });

    const idem =
        req.body.idempotency_key != null && String(req.body.idempotency_key).trim() !== ""
            ? String(req.body.idempotency_key).trim()
            : null;
    if (idem) {
        const dup = await prisma.payment.findFirst({
            where: { order_id, idempotency_key: idem }
        });
        if (dup) {
            logPaymentException({
                level: "info",
                event: "PAYMENT_IDEMPOTENT_REPLAY",
                orderId: order_id,
                paymentId: dup.payment_id,
                detail: { idempotency_key: idem }
            });
            return res.status(200).json({
                duplicate: true,
                message:
                    "Yêu cầu thanh toán đã được ghi nhận trước đó — không tạo giao dịch trùng (idempotency).",
                payment: serializePayment(dup),
                gateway:
                    dup.payment_method === "payment_gateway"
                        ? {
                              reference: dup.transaction_code,
                              demo_checkout_url: `/don-hang/${order_id}#gateway-demo`
                          }
                        : null
            });
        }
    }

    const canAttempt = await assertCanCreateNewPaymentAttempt(prisma, order_id);
    if (!canAttempt.ok) {
        return res.status(409).json({ message: canAttempt.message });
    }

    const gateway_checkout_token = pm === "payment_gateway" ? crypto.randomBytes(24).toString("hex") : null;
    const currency =
        bodyCurrency != null && String(bodyCurrency).trim() !== "" ? String(bodyCurrency).trim() : "VND";
    const payment_gateway =
        bodyGateway != null && String(bodyGateway).trim() !== ""
            ? String(bodyGateway).trim()
            : pm === "payment_gateway"
              ? "demo"
              : null;

    const asyncFlow = pm === "payment_gateway" || pm === "bank_transfer";
    const initialPayStatus = asyncFlow ? "processing" : "pending";

    const payment = await prisma.$transaction(async (tx) => {
        const orderRow = await tx.order.findUnique({ where: { order_id } });
        const prevOrderPay = orderRow?.payment_status;

        const created = await tx.payment.create({
            data: {
                order_id,
                payment_method: pm,
                payment_status: initialPayStatus,
                transaction_code: null,
                paid_at: null,
                gateway_checkout_token,
                currency,
                payment_gateway,
                ...(idem ? { idempotency_key: idem } : {})
            }
        });
        let final = created;
        if (pm === "payment_gateway") {
            const reference = `GW-${created.payment_id}-${Date.now()}`;
            final = await tx.payment.update({
                where: { payment_id: created.payment_id },
                data: { transaction_code: reference }
            });
        }

        if (asyncFlow && prevOrderPay && prevOrderPay !== "processing") {
            await tx.order.update({
                where: { order_id },
                data: {
                    payment_status: "processing",
                    ...(order.preferred_payment_method == null || order.preferred_payment_method === ""
                        ? { preferred_payment_method: pm }
                        : {})
                }
            });
            await appendPaymentStatusLog({
                tx,
                order_id,
                payment_id: null,
                from_status: prevOrderPay,
                to_status: "processing",
                source: "system",
                note:
                    pm === "payment_gateway"
                        ? "Chuyển sang cổng thanh toán / đang xử lý"
                        : "Chuyển khoản — đang xử lý"
            });
        } else if (order.preferred_payment_method == null || order.preferred_payment_method === "") {
            await tx.order.update({
                where: { order_id },
                data: { preferred_payment_method: pm }
            });
        }

        await appendPaymentStatusLog({
            tx,
            order_id,
            payment_id: final.payment_id,
            from_status: null,
            to_status: initialPayStatus,
            source: "system",
            note:
                pm === "cod"
                    ? "COD — thanh toán khi nhận hàng"
                    : pm === "bank_transfer"
                      ? "Chuyển khoản — giao dịch mở"
                      : "Cổng thanh toán — giao dịch mở"
        });

        return final;
    });

    const payload = {
        payment: serializePayment(payment),
        gateway:
            pm === "payment_gateway"
                ? {
                      reference: payment.transaction_code,
                      checkout_token: payment.gateway_checkout_token,
                      redirect_path: `/thanh-toan?token=${encodeURIComponent(payment.gateway_checkout_token || "")}&orderId=${order_id}`,
                      demo_checkout_url: `/don-hang/${order_id}#gateway-demo`,
                      message:
                          "Đang chuyển tới cổng thanh toán (demo). Chọn kết quả trên trang cổng hoặc chờ webhook IPN."
                  }
                : null
    };

    return res.status(201).json(payload);
}

/**
 * Demo / QA: buyer mô phỏng bước 6–7 (callback từ cổng) sau khi đã tạo payment_gateway.
 * Thực tế: cổng gọi POST /api/webhooks/payment-gateway.
 */
async function completeGatewayPaymentDemo(req, res) {
    const user_id = BigInt(req.user.user_id);
    const order_id = BigInt(req.params.id);
    const payment_id = BigInt(req.params.paymentId);
    const { result } = req.body;
    if (result !== "success" && result !== "failed" && result !== "cancelled") {
        return res.status(400).json({
            message: 'result phải là "success", "failed" hoặc "cancelled"'
        });
    }

    const order = await prisma.order.findFirst({ where: { order_id, user_id } });
    if (!order) return res.status(404).json({ message: "Order not found" });

    const payment = await prisma.payment.findFirst({
        where: { payment_id, order_id },
        include: { order: true }
    });
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    if (payment.payment_method !== "payment_gateway") {
        return res.status(400).json({ message: "Chỉ áp dụng cho thanh toán qua cổng (payment_gateway)" });
    }

    const outcomeMap = { success: "success", failed: "failed", cancelled: "cancelled" };
    const outcome = outcomeMap[result];

    try {
        if (payment.gateway_checkout_token) {
            await applyGatewayOutcomeByToken({
                token: payment.gateway_checkout_token,
                userId: user_id,
                outcome
            });
            const p = await prisma.payment.findUnique({
                where: { payment_id },
                include: { order: true }
            });
            return res.json({
                message:
                    result === "success"
                        ? "Thanh toán thành công. Đơn hàng đã cập nhật trạng thái thanh toán."
                        : result === "cancelled"
                          ? "Đã hủy thanh toán (demo)."
                          : "Giao dịch không thành công. Bạn có thể thử lại với giao dịch mới.",
                idempotent: false,
                payment: serializePayment(p),
                order_payment_status: p?.order?.payment_status ?? null
            });
        }

        if (!payment.transaction_code) {
            return res.status(400).json({ message: "Giao dịch thiếu mã tham chiếu cổng (webhook cũ)" });
        }

        const out = await applyGatewayPaymentResult({
            reference: payment.transaction_code,
            success: result === "success"
        });
        return res.json({
            message:
                out.idempotent === true
                    ? "Trạng thái giao dịch đã được ghi nhận trước đó (idempotent)."
                    : result === "success"
                      ? "Thanh toán thành công. Đơn hàng đã cập nhật trạng thái thanh toán."
                      : "Giao dịch không thành công. Bạn có thể thử lại với giao dịch mới.",
            idempotent: out.idempotent === true,
            payment: serializePayment(out.payment),
            order_payment_status: out.order?.payment_status ?? null
        });
    } catch (e) {
        const code = e.statusCode || 500;
        return res.status(code).json({ message: e.message || "Lỗi xử lý cổng thanh toán" });
    }
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
    return res.json(payments.map((p) => serializePayment(p)));
}

module.exports = {
    listMyOrders,
    getMyOrder,
    checkout,
    createPayment,
    completeGatewayPaymentDemo,
    listPayments
};

