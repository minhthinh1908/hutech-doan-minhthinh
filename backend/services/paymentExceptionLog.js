/**
 * Ghi log ngoại lệ thanh toán (JSON dòng — dễ đưa vào ELK / CloudWatch sau này).
 * @param {object} p
 * @param {string} p.level - error | warn | info
 * @param {string} p.event - ví dụ PAYMENT_OUTCOME, PAYMENT_DUPLICATE
 * @param {string|bigint} [p.orderId]
 * @param {string|bigint} [p.paymentId]
 * @param {string} [p.scenario]
 * @param {string} [p.errorCode]
 * @param {unknown} [p.detail]
 */
function logPaymentException(p) {
    const line = JSON.stringify({
        ts: new Date().toISOString(),
        level: p.level || "error",
        event: p.event || "payment_exception",
        orderId: p.orderId != null ? String(p.orderId) : undefined,
        paymentId: p.paymentId != null ? String(p.paymentId) : undefined,
        scenario: p.scenario,
        errorCode: p.errorCode,
        detail:
            p.detail instanceof Error
                ? { message: p.detail.message, stack: p.detail.stack }
                : p.detail
    });
    if (p.level === "info") {
        console.log(line);
    } else if (p.level === "warn") {
        console.warn(line);
    } else {
        console.error(line);
    }
}

module.exports = { logPaymentException };
