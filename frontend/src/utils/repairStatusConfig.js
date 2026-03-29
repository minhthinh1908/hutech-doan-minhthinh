/** Trạng thái yêu cầu sửa chữa — đồng bộ với backend REPAIR_STATUSES */

export const REPAIR_STATUS_ORDER = [
  "pending",
  "received",
  "checking",
  "in_progress",
  "waiting_parts",
  "repaired",
  "rejected",
  "completed",
  "cancelled"
];

export const REPAIR_STATUS_LABELS = {
  pending: "Chờ xử lý",
  received: "Đã tiếp nhận",
  checking: "Đang kiểm tra",
  in_progress: "Đang sửa",
  waiting_parts: "Chờ linh kiện",
  repaired: "Đã sửa xong",
  rejected: "Từ chối",
  completed: "Hoàn tất",
  cancelled: "Đã hủy"
};

/** Legacy */
export function normalizeRepairStatus(s) {
  if (s === "processing") return "in_progress";
  return s;
}

export function repairStatusLabel(s) {
  const n = normalizeRepairStatus(s);
  return REPAIR_STATUS_LABELS[n] || n || "—";
}

export function repairBadgeClass(s) {
  const n = normalizeRepairStatus(s);
  const map = {
    pending: "bd-repair-badge--pending",
    received: "bd-repair-badge--received",
    checking: "bd-repair-badge--checking",
    in_progress: "bd-repair-badge--progress",
    waiting_parts: "bd-repair-badge--parts",
    repaired: "bd-repair-badge--repaired",
    rejected: "bd-repair-badge--rejected",
    completed: "bd-repair-badge--completed",
    cancelled: "bd-repair-badge--cancelled"
  };
  return `bd-repair-badge ${map[n] || "bd-repair-badge--muted"}`;
}
