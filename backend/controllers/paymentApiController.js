const prisma = require("../prisma/client");
const {
    applyGatewayPaymentResult,
    applyGatewayOutcomeByToken,
    newGatewayCheckoutToken
} = require("../services/paymentGatewayService");

const PAYMENT_METHODS = new Set(["cod", "bank_transfer", "payment_gateway"]);

function asBigIntString(v) {
    return typeof v === "bigint" ? v.toString() : v;
}

function serializePayment(p) {
    const { gateway_checkout_token: _g, ...rest } = p || {};
    return {
        ...rest,
        payment_id: asBigIntString(rest.payment_id),
        order_id: asBigIntString(rest.order_id)
    };
}

async function createPaymentRecord(user_id, order_id, pm) {
    const order = await prisma.order.findFirst({ where: { order_id, user_id } });
    if (!order) return { error: { status: 404, body: { message: "Order not found" } } };

    const payment = await prisma.$transaction(async (tx) => {
        const created = await tx.payment.create({
            data: {
                order_id,
                payment_method: pm,
                payment_status: "pending",
                transaction_code: null,
                paid_at: null
            }
        });
        if (pm === "payment_gateway") {
            const reference = `GW-${created.payment_id}-${Date.now()}`;
            const checkoutToken = newGatewayCheckoutToken();
            return tx.payment.update({
                where: { payment_id: created.payment_id },
                data: {
                    transaction_code: reference,
                    gateway_checkout_token: checkoutToken
                }
            });
        }
        return created;
    });

    const payload = {
        payment: serializePayment(payment),
        gateway:
            pm === "payment_gateway"
                ? {
                      reference: payment.transaction_code,
                      checkout_token: payment.gateway_checkout_token,
                      redirect_path: `/thanh-toan?token=${encodeURIComponent(payment.gateway_checkout_token || "")}&orderId=${order_id}`,
                      message:
                          "Đang chuyển tới cổng thanh toán (demo). Sau khi xử lý, trạng thái đơn sẽ cập nhật theo kết quả."
                  }
                : null
    };

    return { payment, pm, order_id, payload };
}

/**
 * POST /api/payments/create
 * body: { order_id, payment_method }
 */
async function create(req, res) {
    const user_id = BigInt(req.user.user_id);
    const order_id_raw = req.body?.order_id;
    const { payment_method } = req.body || {};
    if (order_id_raw == null || order_id_raw === "") {
        return res.status(400).json({ message: "order_id is required" });
    }
    if (!payment_method) {
        return res.status(400).json({ message: "payment_method is required" });
    }
    let order_id;
    try {
        order_id = BigInt(String(order_id_raw));
    } catch {
        return res.status(400).json({ message: "order_id không hợp lệ" });
    }
    const pm = String(payment_method);
    if (!PAYMENT_METHODS.has(pm)) {
        return res.status(400).json({
            message: `payment_method phải là một trong: ${[...PAYMENT_METHODS].join(", ")}`
        });
    }

    const out = await createPaymentRecord(user_id, order_id, pm);
    if (out.error) return res.status(out.error.status).json(out.error.body);
    return res.status(201).json(out.payload);
}

/**
 * POST /api/payments/callback
 * Mock IPN — cùng ý với POST /api/webhooks/payment-gateway (reference + status hoặc success).
 */
async function callback(req, res) {
    const secret = process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET;
    if (secret && String(secret).trim() !== "") {
        const sent = req.headers["x-gateway-secret"];
        if (sent !== secret) {
            return res.status(401).json({ message: "Unauthorized callback" });
        }
    }

    const { reference } = req.body || {};
    if (!reference) {
        return res.status(400).json({ message: "reference là bắt buộc" });
    }

    let successFlag;
    if (typeof req.body?.success === "boolean") {
        successFlag = req.body.success;
    } else if (req.body?.status != null) {
        const st = String(req.body.status).toLowerCase();
        if (st !== "success" && st !== "failed") {
            return res.status(400).json({ message: 'status phải là "success" hoặc "failed"' });
        }
        successFlag = st === "success";
    } else {
        return res.status(400).json({ message: 'Cần success (boolean) hoặc status ("success"|"failed")' });
    }

    try {
        const out = await applyGatewayPaymentResult({
            reference: String(reference).trim(),
            success: successFlag
        });
        return res.json({
            ok: true,
            idempotent: out.idempotent === true,
            order_id: out.order?.order_id != null ? out.order.order_id.toString() : undefined,
            payment_status: out.payment?.payment_status,
            order_payment_status: out.order?.payment_status
        });
    } catch (e) {
        const code = e.statusCode || 500;
        return res.status(code).json({ message: e.message || "Callback error" });
    }
}

/**
 * GET /api/payments/:orderId
 */
async function getByOrder(req, res) {
    const user_id = BigInt(req.user.user_id);
    let order_id;
    try {
        order_id = BigInt(req.params.orderId);
    } catch {
        return res.status(400).json({ message: "orderId không hợp lệ" });
    }
    const order = await prisma.order.findFirst({ where: { order_id, user_id } });
    if (!order) return res.status(404).json({ message: "Order not found" });
    const payments = await prisma.payment.findMany({
        where: { order_id },
        orderBy: { payment_id: "desc" }
    });
    return res.json(payments.map((p) => serializePayment(p)));
}

/**
 * POST /api/payments/:orderId/retry
 */
async function retry(req, res) {
    const user_id = BigInt(req.user.user_id);
    let order_id;
    try {
        order_id = BigInt(req.params.orderId);
    } catch {
        return res.status(400).json({ message: "orderId không hợp lệ" });
    }
    const { payment_method } = req.body || {};
    const pm = payment_method != null ? String(payment_method) : "";
    if (!pm || !PAYMENT_METHODS.has(pm)) {
        return res.status(400).json({
            message: `payment_method là bắt buộc và phải là một trong: ${[...PAYMENT_METHODS].join(", ")}`
        });
    }

    const order = await prisma.order.findFirst({ where: { order_id, user_id } });
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.order_status === "cancelled") {
        return res.status(400).json({ message: "Đơn đã hủy — không thể thử thanh toán lại." });
    }
    if (order.payment_status === "paid") {
        return res.status(400).json({ message: "Đơn đã thanh toán — không cần thử lại." });
    }

    const latest = await prisma.payment.findFirst({
        where: { order_id },
        orderBy: { payment_id: "desc" }
    });
    if (
        latest &&
        latest.payment_method === "payment_gateway" &&
        ["pending", "processing"].includes(String(latest.payment_status || "").toLowerCase())
    ) {
        return res.status(409).json({
            message:
                "Đang có giao dịch cổng ở trạng thái chờ / chờ xác nhận — hoàn tất, hủy hoặc đợi kết quả trước khi tạo giao dịch mới."
        });
    }

    const out = await createPaymentRecord(user_id, order_id, pm);
    if (out.error) return res.status(out.error.status).json(out.error.body);
    return res.status(201).json(out.payload);
}

/**
 * GET /api/payments/gateway/session?token=
 */
async function getGatewaySession(req, res) {
    const token = req.query.token != null ? String(req.query.token).trim() : "";
    if (!token) {
        return res.status(400).json({ message: "Thiếu token thanh toán." });
    }
    const user_id = BigInt(req.user.user_id);
    const payment = await prisma.payment.findFirst({
        where: { gateway_checkout_token: token },
        include: {
            order: {
                select: {
                    order_id: true,
                    user_id: true,
                    total_amount: true,
                    payment_status: true,
                    order_status: true,
                    preferred_payment_method: true
                }
            }
        }
    });
    if (!payment || !payment.order) {
        return res.status(404).json({ message: "Không tìm thấy phiên thanh toán." });
    }
    if (payment.order.user_id !== user_id) {
        return res.status(403).json({ message: "Không có quyền xem giao dịch này." });
    }
    if (payment.payment_method !== "payment_gateway") {
        return res.status(400).json({ message: "Phiên không phải cổng thanh toán." });
    }

    return res.json({
        payment_id: asBigIntString(payment.payment_id),
        order_id: asBigIntString(payment.order_id),
        payment_status: payment.payment_status,
        total_amount: payment.order.total_amount != null ? String(payment.order.total_amount) : null,
        order_payment_status: payment.order.payment_status,
        order_status: payment.order.order_status
    });
}

/**
 * POST /api/payments/gateway/complete
 * body: { token, outcome } — success | failed | cancelled | pending
 */
async function completeGateway(req, res) {
    const userId = BigInt(req.user.user_id);
    const token = req.body?.token != null ? String(req.body.token).trim() : "";
    const outcome = req.body?.outcome != null ? String(req.body.outcome).trim() : "";
    try {
        const { payment, order } = await applyGatewayOutcomeByToken({
            token,
            userId,
            outcome
        });
        const msg =
            outcome === "success"
                ? "Thanh toán thành công — đơn đã xác nhận / đã cập nhật thanh toán."
                : outcome === "failed"
                  ? "Thanh toán thất bại — bạn có thể thử lại từ trang đơn hàng."
                  : outcome === "cancelled"
                    ? "Bạn đã hủy thanh toán — đơn vẫn chờ thanh toán, có thể chọn lại phương thức."
                    : "Giao dịch đang chờ xác nhận từ cổng / ngân hàng.";
        return res.json({
            message: msg,
            payment: serializePayment(payment),
            order_payment_status: order.payment_status,
            order_status: order.order_status
        });
    } catch (e) {
        const code = e.statusCode || 500;
        return res.status(code).json({ message: e.message || "Lỗi xử lý cổng thanh toán" });
    }
}

module.exports = {
    createPaymentRecord,
    serializePayment,
    create,
    callback,
    getByOrder,
    retry,
    getGatewaySession,
    completeGateway
};
