/**
 * Quy tắc nghiệp vụ thanh toán (đơn ↔ payment ↔ cổng ↔ hoàn tiền).
 */

const ALLOWED_PAYMENT_METHODS = ["cod", "bank_transfer", "payment_gateway"];

/** Giao dịch đã thu tiền — cổng dùng `success`; COD/chuyển khoản có thể dùng `paid` khi admin xác nhận */
const PAYMENT_LINE_SUCCESS = "success";

/** Giao dịch còn mở — chưa cho tạo lần thanh toán mới */
const PENDING_LIKE = ["pending", "awaiting_confirmation", "processing"];

const { appendPaymentStatusLog } = require("./paymentStatusLog");

/**
 * Buyer không được gửi payment_status khi tạo payment.
 */
function assertBuyerDoesNotSetPaymentStatus(body) {
    if (body == null) return { ok: true };
    if (Object.prototype.hasOwnProperty.call(body, "payment_status")) {
        return {
            ok: false,
            message: "Không được gửi payment_status — trạng thái do hệ thống/cổng quản lý."
        };
    }
    return { ok: true };
}

function normalizeMethod(m) {
    return String(m || "")
        .trim()
        .toLowerCase();
}

function assertAllowedPaymentMethod(payment_method) {
    const m = normalizeMethod(payment_method);
    if (!ALLOWED_PAYMENT_METHODS.includes(m)) {
        return {
            ok: false,
            message: `payment_method phải là một trong: ${ALLOWED_PAYMENT_METHODS.join(", ")}`
        };
    }
    return { ok: true, method: m };
}

/**
 * Không tạo giao dịch mới khi đã còn giao dịch chờ (trừ khi đã failed/cancelled — cho phép thử lại).
 */
async function assertCanCreateNewPaymentAttempt(prisma, order_id) {
    const blocking = await prisma.payment.findFirst({
        where: {
            order_id,
            payment_status: { in: PENDING_LIKE }
        }
    });
    if (blocking) {
        return {
            ok: false,
            message:
                "Đơn đã có giao dịch chờ xử lý — hoàn tất, hủy hoặc thất bại trước khi tạo giao dịch thanh toán mới."
        };
    }
    return { ok: true };
}

/**
 * Admin không được tự đánh dấu paid/success cho giao dịch cổng (chỉ webhook / luồng gateway).
 */
function assertAdminCannotMarkGatewayPaidWithoutFlow(existingPayment, newStatus) {
    if (newStatus === undefined) return { ok: true };
    const st = String(newStatus).toLowerCase();
    const isPaidLike = st === "success" || st === "paid";
    const method = String(existingPayment.payment_method || "").toLowerCase();
    if (method === "payment_gateway" && isPaidLike) {
        return {
            ok: false,
            message:
                "Không đánh dấu paid/success thủ công cho payment_gateway — chỉ sau khi cổng xác nhận (webhook / hoàn tất phiên thanh toán)."
        };
    }
    return { ok: true };
}

/**
 * Không đặt order.payment_status = paid nếu chưa có ít nhất một payment thành công (COD/chuyển khoản xác nhận hoặc cổng success).
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} prismaOrTx
 */
async function assertOrderCanBeMarkedPaid(prismaOrTx, order_id) {
    const okPay = await prismaOrTx.payment.findFirst({
        where: {
            order_id,
            payment_status: { in: [PAYMENT_LINE_SUCCESS, "paid"] }
        }
    });
    if (!okPay) {
        return {
            ok: false,
            message:
                "Không đặt đơn ở trạng thái paid khi chưa có giao dịch thanh toán thành công — xác nhận qua PATCH /admin/payments/:id (COD/chuyển khoản) hoặc cổng thanh toán."
        };
    }
    return { ok: true };
}

/**
 * Admin đặt đơn paid: tự đồng bộ dòng COD / chuyển khoản đang chờ → success (đối soát thủ công).
 * Gọi trong transaction trước assertOrderCanBeMarkedPaid.
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 */
async function syncCodBankTransferPaymentsForAdminPaidOrder(tx, order_id) {
    const order = await tx.order.findUnique({
        where: { order_id },
        include: { payments: true }
    });
    if (!order) return { ok: false, message: "Order not found" };

    const hasSuccess = order.payments.some((p) => {
        const st = String(p.payment_status || "").toLowerCase();
        return st === PAYMENT_LINE_SUCCESS || st === "paid";
    });
    if (hasSuccess) return { ok: true };

    const manual = order.payments.filter((p) => {
        const m = normalizeMethod(p.payment_method);
        const st = String(p.payment_status || "").toLowerCase();
        return (m === "cod" || m === "bank_transfer") && PENDING_LIKE.includes(st);
    });

    if (manual.length === 0) {
        return {
            ok: false,
            message:
                "Chưa có giao dịch thanh toán thành công. Với COD/chuyển khoản: đảm bảo đơn có dòng thanh toán đang chờ. Với cổng thanh toán: xác nhận qua PATCH /admin/payments/:id sau khi cổng xác nhận."
        };
    }

    const now = new Date();
    for (const p of manual) {
        await tx.payment.update({
            where: { payment_id: p.payment_id },
            data: {
                payment_status: PAYMENT_LINE_SUCCESS,
                paid_at: now,
                paid_amount: order.total_amount,
                transaction_code: p.transaction_code || `ADM-${now.getTime()}-${p.payment_id}`
            }
        });
        await appendPaymentStatusLog({
            tx,
            order_id,
            payment_id: p.payment_id,
            from_status: p.payment_status,
            to_status: PAYMENT_LINE_SUCCESS,
            source: "admin",
            note: "Đối soát khi admin đặt đơn ở trạng thái đã thanh toán (COD/chuyển khoản)"
        });
    }
    return { ok: true };
}

module.exports = {
    ALLOWED_PAYMENT_METHODS,
    PAYMENT_LINE_SUCCESS,
    PENDING_LIKE,
    assertBuyerDoesNotSetPaymentStatus,
    assertAllowedPaymentMethod,
    assertCanCreateNewPaymentAttempt,
    assertAdminCannotMarkGatewayPaidWithoutFlow,
    assertOrderCanBeMarkedPaid,
    syncCodBankTransferPaymentsForAdminPaidOrder
};
