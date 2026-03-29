const prisma = require("../prisma/client");
const { logPaymentException } = require("./paymentExceptionLog");

/** Các scenario mô phỏng / xử lý ngoại lệ (đồng bộ README mục 10) */
const OUTCOME_SCENARIOS = {
    gateway_timeout: {
        error_code: "GATEWAY_TIMEOUT",
        payment_status: "timeout",
        buyer_message:
            "Cổng thanh toán không phản hồi kịp thời. Tiền chưa bị trừ; vui lòng thử lại sau hoặc chọn phương thức khác.",
        is_abnormal: true,
        technical: "Gateway timeout (simulated)"
    },
    invalid_payment_info: {
        error_code: "INVALID_PAYMENT_INFO",
        payment_status: "failed",
        buyer_message:
            "Thông tin thanh toán không hợp lệ (số thẻ, OTP, hoặc tài khoản). Vui lòng kiểm tra và thử lại.",
        is_abnormal: true,
        technical: "Invalid card or account data rejected by PSP"
    },
    user_cancelled: {
        error_code: "USER_CANCELLED",
        payment_status: "cancelled",
        buyer_message: "Bạn đã hủy thanh toán. Đơn vẫn chờ thanh toán — bạn có thể chọn phương thức khác.",
        is_abnormal: false,
        technical: "User aborted checkout at gateway"
    },
    gateway_error: {
        error_code: "GATEWAY_ERROR",
        payment_status: "failed",
        buyer_message:
            "Cổng thanh toán báo lỗi tạm thời. Nếu tiền đã trừ, ngân hàng sẽ hoàn tự động; vui lòng liên hệ shop nếu cần.",
        is_abnormal: true,
        technical: "Gateway returned error status"
    },
    /** Tiền đã trừ tại ngân hàng nhưng callback/webhook không về hệ thống */
    callback_failed: {
        error_code: "CALLBACK_FAILED",
        payment_status: "callback_failed",
        buyer_message:
            "Hệ thống chưa nhận được xác nhận từ cổng sau khi bạn thanh toán. Đội ngũ sẽ đối soát thủ công — bạn không cần thanh toán lại.",
        is_abnormal: true,
        technical: "Success at bank but webhook/callback delivery failed"
    },
    /** Giao dịch trùng (cùng mã tham chiếu) — xử lý tại tầng idempotency; giữ để log */
    duplicate: {
        error_code: "DUPLICATE_TRANSACTION",
        payment_status: "failed",
        buyer_message: "Giao dịch bị trùng. Hệ thống chỉ ghi nhận một lần — không trừ tiền thêm.",
        is_abnormal: true,
        technical: "Duplicate transaction reference"
    }
};

/**
 * Áp dụng kết quả mô phỏng / ngoại lệ cho một payment (đã xác thực quyền sở hữu đơn).
 */
async function applyPaymentOutcomeScenario({ payment_id, order_id, scenario }) {
    const spec = OUTCOME_SCENARIOS[scenario];
    if (!spec) {
        const err = new Error(
            `scenario không hợp lệ. Dùng: ${Object.keys(OUTCOME_SCENARIOS).join(", ")}`
        );
        err.statusCode = 400;
        throw err;
    }

    const payment = await prisma.payment.findFirst({
        where: { payment_id, order_id },
        include: { order: true }
    });
    if (!payment) {
        const err = new Error("Không tìm thấy thanh toán.");
        err.statusCode = 404;
        throw err;
    }

    if (payment.payment_method !== "payment_gateway") {
        const err = new Error("Chỉ mô phỏng ngoại lệ cho cổng thanh toán (payment_gateway).");
        err.statusCode = 400;
        throw err;
    }

    const st = String(payment.payment_status || "").toLowerCase();
    if ((st === "success" || st === "paid") && scenario !== "duplicate") {
        const err = new Error("Giao dịch đã thành công — không áp dụng ngoại lệ.");
        err.statusCode = 400;
        throw err;
    }

    logPaymentException({
        level: spec.is_abnormal ? "error" : "warn",
        event: "PAYMENT_OUTCOME_SIMULATED",
        orderId: order_id,
        paymentId: payment_id,
        scenario,
        errorCode: spec.error_code,
        detail: spec.technical
    });

    await prisma.$transaction(async (tx) => {
        const o = await tx.order.findUnique({ where: { order_id } });
        if (!o) return;

        await tx.payment.update({
            where: { payment_id },
            data: {
                payment_status: spec.payment_status,
                error_code: spec.error_code,
                buyer_message: spec.buyer_message,
                failure_reason: spec.technical,
                is_abnormal: spec.is_abnormal,
                paid_at: null,
                paid_amount: null,
                transaction_code: payment.transaction_code
            }
        });

        const paid = String(o.payment_status || "") === "paid";
        if (!paid && scenario !== "callback_failed") {
            await tx.order.update({
                where: { order_id },
                data: { payment_status: "unpaid" }
            });
        } else if (scenario === "callback_failed") {
            await tx.order.update({
                where: { order_id },
                data: { payment_status: "pending_confirmation" }
            });
        }
    });

    const updated = await prisma.payment.findUnique({
        where: { payment_id },
        include: { order: true }
    });

    return {
        buyer_message: spec.buyer_message,
        payment: updated,
        scenario
    };
}

module.exports = {
    OUTCOME_SCENARIOS,
    applyPaymentOutcomeScenario
};
