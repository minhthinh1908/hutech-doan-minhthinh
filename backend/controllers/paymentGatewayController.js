const { applyGatewayOutcomeByToken } = require("../services/paymentGatewayService");

/**
 * Hoàn tất phiên cổng khi đã có bản ghi payment + order (đường demo từ order routes).
 * outcome: success | failed | cancelled
 */
async function applyGatewayOutcome(payment, outcome) {
    if (!payment?.gateway_checkout_token) {
        const err = new Error("Thiếu phiên cổng (gateway_checkout_token).");
        err.statusCode = 400;
        throw err;
    }
    if (!payment.order?.user_id) {
        const err = new Error("Thiếu thông tin đơn hàng.");
        err.statusCode = 400;
        throw err;
    }
    await applyGatewayOutcomeByToken({
        token: payment.gateway_checkout_token,
        userId: payment.order.user_id,
        outcome
    });
}

module.exports = { applyGatewayOutcome };
