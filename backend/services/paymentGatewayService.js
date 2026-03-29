const crypto = require("crypto");
const prisma = require("../prisma/client");
const { appendPaymentStatusLog } = require("./paymentStatusLog");
const { logPaymentException } = require("./paymentExceptionLog");

function isPaymentPaidLike(p) {
    const s = String(p?.payment_status || "").toLowerCase();
    return s === "paid" || s === "success";
}

function isPaymentFailedLike(p) {
    const s = String(p?.payment_status || "").toLowerCase();
    return s === "failed";
}

/**
 * Áp dụng kết quả từ Payment Gateway (webhook IPN — tham chiếu transaction_code).
 * @param {object} opts
 * @param {string} opts.reference — Khớp payment.transaction_code
 * @param {boolean} opts.success
 */
async function applyGatewayPaymentResult({ reference, success }) {
    if (!reference || String(reference).trim() === "") {
        const err = new Error("reference là bắt buộc");
        err.statusCode = 400;
        throw err;
    }

    const ref = String(reference).trim();

    const payment = await prisma.payment.findFirst({
        where: { transaction_code: ref },
        include: { order: true }
    });

    if (!payment) {
        logPaymentException({
            level: "warn",
            event: "GATEWAY_WEBHOOK_UNKNOWN_REF",
            detail: { reference: ref }
        });
        const err = new Error("Không tìm thấy giao dịch với mã tham chiếu này");
        err.statusCode = 404;
        throw err;
    }

    if (payment.payment_method !== "payment_gateway") {
        const err = new Error("Giao dịch không thuộc cổng thanh toán trực tuyến");
        err.statusCode = 400;
        throw err;
    }

    const pendingLike = ["pending", "processing"];
    const st = String(payment.payment_status || "").toLowerCase();
    if (!pendingLike.includes(st)) {
        if (isPaymentPaidLike(payment) && success) {
            return { payment, order: payment.order, idempotent: true };
        }
        if (isPaymentFailedLike(payment) && !success) {
            return { payment, order: payment.order, idempotent: true };
        }
        const err = new Error("Giao dịch đã được xử lý trước đó");
        err.statusCode = 409;
        throw err;
    }

    const orderBefore = payment.order;
    const fromOrderPay = orderBefore?.payment_status ?? null;
    const fromPay = payment.payment_status;

    await prisma.$transaction(async (tx) => {
        if (success) {
            await tx.payment.update({
                where: { payment_id: payment.payment_id },
                data: {
                    payment_status: "paid",
                    paid_at: new Date(),
                    paid_amount: payment.order.total_amount,
                    transaction_code: payment.transaction_code || ref,
                    failure_reason: null,
                    error_code: null,
                    buyer_message: null,
                    is_abnormal: false,
                    gateway_response: {
                        reference: ref,
                        source: "webhook",
                        success: true,
                        recorded_at: new Date().toISOString()
                    },
                    payment_gateway: payment.payment_gateway || "demo"
                }
            });
            const oStatus = String(orderBefore.order_status || "");
            const orderData = { payment_status: "paid" };
            if (oStatus === "pending") {
                orderData.order_status = "confirmed";
            }
            await tx.order.update({
                where: { order_id: payment.order_id },
                data: orderData
            });
            await appendPaymentStatusLog({
                tx,
                order_id: payment.order_id,
                payment_id: payment.payment_id,
                from_status: fromPay,
                to_status: "paid",
                source: "gateway",
                note: "Webhook / IPN: thành công"
            });
            await appendPaymentStatusLog({
                tx,
                order_id: payment.order_id,
                payment_id: null,
                from_status: fromOrderPay,
                to_status: "paid",
                source: "gateway",
                note: "Đơn: thanh toán thành công"
            });
        } else {
            await tx.payment.update({
                where: { payment_id: payment.payment_id },
                data: {
                    payment_status: "failed",
                    paid_at: null,
                    paid_amount: null,
                    failure_reason: "Giao dịch không thành công (cổng / ngân hàng).",
                    error_code: "GATEWAY_DECLINED",
                    buyer_message:
                        "Giao dịch không thành công tại cổng. Bạn có thể thử lại hoặc đổi phương thức thanh toán.",
                    is_abnormal: true,
                    gateway_response: {
                        reference: ref,
                        source: "webhook",
                        success: false,
                        recorded_at: new Date().toISOString()
                    },
                    payment_gateway: payment.payment_gateway || "demo"
                }
            });
            await tx.order.update({
                where: { order_id: payment.order_id },
                data: { payment_status: "pending" }
            });
            await appendPaymentStatusLog({
                tx,
                order_id: payment.order_id,
                payment_id: payment.payment_id,
                from_status: fromPay,
                to_status: "failed",
                source: "gateway",
                note: "Webhook: thất bại — khách có thể thử thanh toán lại"
            });
            await appendPaymentStatusLog({
                tx,
                order_id: payment.order_id,
                payment_id: null,
                from_status: fromOrderPay,
                to_status: "pending",
                source: "gateway",
                note: "Đơn: chờ thanh toán (thất bại, có thể thử lại)"
            });
        }
    });

    const updated = await prisma.payment.findUnique({
        where: { payment_id: payment.payment_id },
        include: { order: true }
    });

    if (!success) {
        logPaymentException({
            event: "GATEWAY_WEBHOOK_FAILURE",
            orderId: payment.order_id,
            paymentId: payment.payment_id,
            errorCode: "GATEWAY_DECLINED",
            detail: { reference: ref }
        });
    }

    return { payment: updated, order: updated.order, idempotent: false };
}

const OUTCOMES = ["success", "failed", "cancelled", "pending"];

/**
 * Hoàn tất phiên cổng qua token một lần (demo / redirect buyer sau khi đăng nhập).
 * @param {object} opts
 * @param {string} opts.token — gateway_checkout_token
 * @param {bigint} opts.userId
 * @param {string} opts.outcome — success | failed | cancelled | pending (chờ xác nhận)
 */
async function applyGatewayOutcomeByToken({ token, userId, outcome }) {
    if (!token || String(token).trim() === "") {
        const err = new Error("Thiếu token thanh toán.");
        err.statusCode = 400;
        throw err;
    }
    if (!OUTCOMES.includes(String(outcome))) {
        const err = new Error(`outcome phải là một trong: ${OUTCOMES.join(", ")}`);
        err.statusCode = 400;
        throw err;
    }

    const t = String(token).trim();
    const payment = await prisma.payment.findFirst({
        where: { gateway_checkout_token: t },
        include: { order: true }
    });

    if (!payment) {
        const err = new Error("Không tìm thấy phiên thanh toán.");
        err.statusCode = 404;
        throw err;
    }
    if (payment.order.user_id !== userId) {
        const err = new Error("Không có quyền thao tác giao dịch này.");
        err.statusCode = 403;
        throw err;
    }
    if (payment.payment_method !== "payment_gateway") {
        const err = new Error("Phiên không phải cổng thanh toán.");
        err.statusCode = 400;
        throw err;
    }
    if (isPaymentPaidLike(payment)) {
        const err = new Error("Giao dịch đã thành công — không thể đổi trạng thái.");
        err.statusCode = 400;
        throw err;
    }

    const order = payment.order;
    const orderWasPaid = String(order.payment_status).toLowerCase() === "paid";
    const oStatus = String(order.order_status || "");
    const fromPay = payment.payment_status;
    const fromOrderPay = order.payment_status;
    const now = new Date();
    const refLine = payment.transaction_code || `GW-${payment.payment_id}-${now.getTime()}`;
    const txCode = `${refLine}-IPN-${crypto.randomBytes(3).toString("hex")}`;

    await prisma.$transaction(async (tx) => {
        if (outcome === "success") {
            await tx.payment.update({
                where: { payment_id: payment.payment_id },
                data: {
                    payment_status: "paid",
                    paid_at: now,
                    paid_amount: order.total_amount,
                    transaction_code: refLine,
                    failure_reason: null,
                    error_code: null,
                    buyer_message: null,
                    is_abnormal: false
                }
            });
            const orderData = { payment_status: "paid" };
            if (oStatus === "pending") {
                orderData.order_status = "confirmed";
            }
            await tx.order.update({
                where: { order_id: order.order_id },
                data: orderData
            });
            await appendPaymentStatusLog({
                tx,
                order_id: order.order_id,
                payment_id: payment.payment_id,
                from_status: fromPay,
                to_status: "paid",
                source: "gateway",
                note: "Buyer hoàn tất cổng (demo): thành công"
            });
            await appendPaymentStatusLog({
                tx,
                order_id: order.order_id,
                payment_id: null,
                from_status: fromOrderPay,
                to_status: "paid",
                source: "gateway",
                note: "Đơn: đã thanh toán"
            });
        } else if (outcome === "failed") {
            await tx.payment.update({
                where: { payment_id: payment.payment_id },
                data: {
                    payment_status: "failed",
                    paid_at: null,
                    paid_amount: null,
                    failure_reason: "Thanh toán thất bại."
                }
            });
            if (!orderWasPaid) {
                await tx.order.update({
                    where: { order_id: order.order_id },
                    data: { payment_status: "pending" }
                });
            }
            await appendPaymentStatusLog({
                tx,
                order_id: order.order_id,
                payment_id: payment.payment_id,
                from_status: fromPay,
                to_status: "failed",
                source: "gateway",
                note: "Buyer / cổng: thất bại — có thể thử lại"
            });
            if (!orderWasPaid) {
                await appendPaymentStatusLog({
                    tx,
                    order_id: order.order_id,
                    payment_id: null,
                    from_status: fromOrderPay,
                    to_status: "pending",
                    source: "gateway",
                    note: "Đơn: chờ thanh toán"
                });
            }
        } else if (outcome === "cancelled") {
            await tx.payment.update({
                where: { payment_id: payment.payment_id },
                data: {
                    payment_status: "cancelled",
                    paid_at: null,
                    paid_amount: null,
                    failure_reason: "Người dùng hủy thanh toán tại cổng."
                }
            });
            if (!orderWasPaid) {
                await tx.order.update({
                    where: { order_id: order.order_id },
                    data: { payment_status: "cancelled" }
                });
            }
            await appendPaymentStatusLog({
                tx,
                order_id: order.order_id,
                payment_id: payment.payment_id,
                from_status: fromPay,
                to_status: "cancelled",
                source: "gateway",
                note: "Buyer hủy giao dịch — có thể chọn thanh toán lại"
            });
            if (!orderWasPaid) {
                await appendPaymentStatusLog({
                    tx,
                    order_id: order.order_id,
                    payment_id: null,
                    from_status: fromOrderPay,
                    to_status: "cancelled",
                    source: "gateway",
                    note: "Đơn: khách hủy thanh toán (có thể tạo giao dịch mới)"
                });
            }
        } else if (outcome === "pending") {
            await tx.payment.update({
                where: { payment_id: payment.payment_id },
                data: {
                    payment_status: "processing",
                    paid_at: null,
                    transaction_code: txCode,
                    failure_reason: null
                }
            });
            await tx.order.update({
                where: { order_id: order.order_id },
                data: { payment_status: "processing" }
            });
            await appendPaymentStatusLog({
                tx,
                order_id: order.order_id,
                payment_id: payment.payment_id,
                from_status: fromPay,
                to_status: "processing",
                source: "gateway",
                note: "Chờ xác nhận từ cổng / ngân hàng"
            });
            await appendPaymentStatusLog({
                tx,
                order_id: order.order_id,
                payment_id: null,
                from_status: fromOrderPay,
                to_status: "processing",
                source: "gateway",
                note: "Đơn: chờ xác nhận thanh toán"
            });
        }
    });

    const fresh = await prisma.payment.findUnique({
        where: { payment_id: payment.payment_id },
        include: { order: true }
    });
    return { payment: fresh, order: fresh.order };
}

function newGatewayCheckoutToken() {
    return crypto.randomBytes(24).toString("hex");
}

module.exports = {
    applyGatewayPaymentResult,
    applyGatewayOutcomeByToken,
    newGatewayCheckoutToken,
    OUTCOMES
};
