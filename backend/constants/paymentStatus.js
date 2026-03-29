/**
 * Trạng thái thanh toán thống nhất (Order.payment_status & Payment.payment_status).
 * pending | processing | paid | failed | cancelled | refunded
 */
const ALLOWED_PAYMENT_STATUSES = ["pending", "processing", "paid", "failed", "cancelled", "refunded"];

function isAllowedPaymentStatus(s) {
    return ALLOWED_PAYMENT_STATUSES.includes(String(s));
}

/** Chuẩn hóa giá trị cũ đọc từ DB / tích hợp cũ */
function normalizeLegacyPaymentStatus(s) {
    const x = String(s || "")
        .trim()
        .toLowerCase();
    if (x === "unpaid" || x === "") return "pending";
    if (x === "success") return "paid";
    if (x === "pending_confirmation") return "processing";
    if (x === "awaiting_confirmation") return "processing";
    return x;
}

module.exports = {
    ALLOWED_PAYMENT_STATUSES,
    isAllowedPaymentStatus,
    normalizeLegacyPaymentStatus
};
