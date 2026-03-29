/** Trạng thái thanh toán chuẩn — đồng bộ backend (orders + payments) */

const BUYER = {
  pending: "Chưa thanh toán",
  processing: "Đang xử lý thanh toán",
  paid: "Đã thanh toán",
  failed: "Thanh toán không thành công",
  cancelled: "Đã hủy thanh toán",
  refunded: "Đã hoàn tiền",
  pending_confirmation: "Chờ xác nhận thanh toán",
  timeout: "Cổng không phản hồi kịp thời — có thể thử lại",
  callback_failed: "Đang đối soát với cổng — không cần thanh toán lại"
};

/** Admin: mã + giải thích ngắn */
const ADMIN = {
  pending: "pending — Đơn đã tạo, chưa thanh toán",
  processing: "processing — Đang chuyển cổng / đang xử lý giao dịch",
  paid: "paid — Thanh toán thành công",
  failed: "failed — Giao dịch thất bại",
  cancelled: "cancelled — Khách hủy thanh toán",
  refunded: "refunded — Đã hoàn tiền"
};

const SOURCE = {
  system: "Hệ thống",
  admin: "Quản trị viên",
  buyer: "Khách hàng",
  gateway: "Cổng thanh toán"
};

export function paymentStatusBuyerLabel(code) {
  const k = String(code || "").toLowerCase();
  if (k === "unpaid" || k === "success") {
    return k === "success" ? BUYER.paid : BUYER.pending;
  }
  return BUYER[k] || code || "—";
}

export function paymentStatusAdminLabel(code) {
  const k = String(code || "").toLowerCase();
  if (k === "unpaid") return `${ADMIN.pending} (legacy: unpaid)`;
  if (k === "success") return `${ADMIN.paid} (legacy: success)`;
  return ADMIN[k] || code || "—";
}

export function paymentLogSourceLabel(source) {
  return SOURCE[String(source || "").toLowerCase()] || source || "—";
}

export const PAYMENT_STATUS_OPTIONS = [
  { value: "pending", label: ADMIN.pending },
  { value: "processing", label: ADMIN.processing },
  { value: "paid", label: ADMIN.paid },
  { value: "failed", label: ADMIN.failed },
  { value: "cancelled", label: ADMIN.cancelled },
  { value: "refunded", label: ADMIN.refunded }
];
