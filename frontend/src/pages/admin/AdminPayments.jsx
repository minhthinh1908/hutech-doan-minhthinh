import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPatch } from "../../api/client.js";
import { paymentStatusAdminLabel } from "../../utils/paymentStatusLabels.js";
import "./AdminPages.css";

function money(n) {
  if (n == null || n === "") return "—";
  return Number(n).toLocaleString("vi-VN");
}

function fmtDt(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return String(iso);
  }
}

const PAY_METHOD_LABELS = {
  cod: "COD (thanh toán khi nhận)",
  bank_transfer: "Chuyển khoản",
  payment_gateway: "Cổng thanh toán trực tuyến"
};

function payMethodLabel(code) {
  if (!code) return "—";
  return PAY_METHOD_LABELS[code] || code;
}

/** Trạng thái dòng payment (gateway / đối soát) */
function payRowStatusLabel(s) {
  const k = String(s || "").toLowerCase();
  const tech = {
    timeout: "Timeout cổng",
    callback_failed: "Callback lỗi",
    awaiting_confirmation: "awaiting_confirmation (legacy)"
  };
  if (tech[k]) return tech[k];
  if (k === "success") return paymentStatusAdminLabel("paid");
  return paymentStatusAdminLabel(s);
}

/** Trạng thái thanh toán cấp đơn hàng */
function orderPayLabel(s) {
  const k = String(s || "").toLowerCase();
  if (k === "pending_confirmation") return "Chờ xác nhận (legacy)";
  return paymentStatusAdminLabel(s);
}

function toDatetimeLocalValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STATUS_FILTER = [
  { value: "all", label: "Mọi trạng thái GD" },
  { value: "pending", label: "Đang chờ" },
  { value: "processing", label: "Đang xử lý" },
  { value: "paid", label: "paid — Thành công" },
  { value: "success", label: "success (legacy)" },
  { value: "failed", label: "Thất bại" },
  { value: "refunded", label: "Hoàn tiền" },
  { value: "timeout", label: "Timeout cổng" },
  { value: "callback_failed", label: "Callback lỗi" },
  { value: "cancelled", label: "Đã hủy (GD)" }
];

function displayAmount(p) {
  if (p.paid_amount != null && p.paid_amount !== "") return p.paid_amount;
  return p.order?.total_amount ?? null;
}

export default function AdminPayments() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  /** Xem nhanh: thất bại (GD hoặc đơn) / đơn hoàn tiền */
  const [quick, setQuick] = useState("");
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);

  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState("");

  const [form, setForm] = useState({
    payment_status: "",
    transaction_code: "",
    paid_amount: "",
    paid_at: ""
  });

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    const params = {};
    if (quick) {
      params.quick = quick;
    } else if (statusFilter && statusFilter !== "all") {
      params.payment_status = statusFilter;
    }
    if (qDebounced) params.q = qDebounced;
    const data = await apiGet("/admin/payments", params);
    setRows(Array.isArray(data) ? data : []);
  }, [statusFilter, qDebounced, quick]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        await load();
      } catch (e) {
        if (!cancelled) setErr(e.message || "Không tải được lịch sử thanh toán.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  function openEdit(p) {
    setEdit(p);
    setForm({
      payment_status: p.payment_status || "pending",
      transaction_code: p.transaction_code || "",
      paid_amount: p.paid_amount != null ? String(p.paid_amount) : "",
      paid_at: toDatetimeLocalValue(p.paid_at)
    });
    setErr("");
    setMsg("");
  }

  function closeEdit() {
    setEdit(null);
    setSaving(false);
  }

  async function saveEdit() {
    if (!edit) return;
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      const body = {
        payment_status: form.payment_status,
        transaction_code: form.transaction_code.trim() || null,
        paid_amount: form.paid_amount.trim() === "" ? null : Number(form.paid_amount.replace(/\s/g, "").replace(",", ".")),
        paid_at: form.paid_at ? new Date(form.paid_at).toISOString() : null
      };
      if (body.paid_amount != null && (!Number.isFinite(body.paid_amount) || body.paid_amount < 0)) {
        setErr("Số tiền đã thu không hợp lệ.");
        setSaving(false);
        return;
      }
      await apiPatch(`/admin/payments/${edit.payment_id}`, body, { auth: true });
      setMsg("Đã cập nhật dữ liệu đối soát.");
      await load();
      closeEdit();
    } catch (e) {
      setErr(e.message || "Không lưu được.");
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(paymentId) {
    setDetailId(paymentId);
    setDetail(null);
    setDetailErr("");
    setDetailLoading(true);
    try {
      const data = await apiGet(`/admin/payments/${paymentId}`);
      setDetail(data);
    } catch (e) {
      setDetailErr(e.message || "Không tải được chi tiết.");
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setDetailId(null);
    setDetail(null);
    setDetailErr("");
  }

  function setQuickFilter(next) {
    setQuick(next);
    if (next) setStatusFilter("all");
  }

  return (
    <div className="admin-page">
      <h1>Thanh toán (Payment Gateway)</h1>
      <p className="admin-page__muted">
        Danh sách giao dịch đã ghi nhận (cổng, chuyển khoản, COD). Tra cứu theo{" "}
        <strong>mã giao dịch</strong>, lọc theo <strong>trạng thái</strong>, xem nhanh{" "}
        <strong>thất bại</strong> hoặc đơn <strong>hoàn tiền</strong>. Admin chỉ xem / đối soát bản ghi — không thực hiện
        giao dịch trực tiếp trên cổng tại đây.
      </p>
      {err ? (
        <p className="admin-msg admin-msg--err" role="alert">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="admin-msg admin-msg--ok" role="status">
          {msg}
        </p>
      ) : null}

      <div className="admin-orders-toolbar" role="search">
        <label className="admin-orders-toolbar__field">
          <span className="admin-orders-toolbar__label">Trạng thái giao dịch</span>
          <select
            className="admin-orders-toolbar__select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              if (e.target.value !== "all") setQuick("");
            }}
            disabled={!!quick}
            aria-label="Lọc trạng thái thanh toán"
          >
            {STATUS_FILTER.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <div className="admin-orders-toolbar__field" style={{ flexWrap: "wrap" }}>
          <span className="admin-orders-toolbar__label">Xem nhanh</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
            <button
              type="button"
              className={`admin-btn admin-btn--sm${quick === "failed" ? "" : " admin-btn--secondary"}`}
              onClick={() => setQuickFilter(quick === "failed" ? "" : "failed")}
            >
              {quick === "failed" ? "✓ Thất bại" : "GD / đơn thất bại"}
            </button>
            <button
              type="button"
              className={`admin-btn admin-btn--sm${quick === "refunded" ? "" : " admin-btn--secondary"}`}
              onClick={() => setQuickFilter(quick === "refunded" ? "" : "refunded")}
            >
              {quick === "refunded" ? "✓ Hoàn tiền" : "Đơn hoàn tiền"}
            </button>
            <button
              type="button"
              className={`admin-btn admin-btn--sm${quick === "abnormal" ? "" : " admin-btn--secondary"}`}
              onClick={() => setQuickFilter(quick === "abnormal" ? "" : "abnormal")}
              title="Lỗi cổng, timeout, callback lỗi, hoặc cờ bất thường"
            >
              {quick === "abnormal" ? "✓ Bất thường" : "GD bất thường / lỗi"}
            </button>
          </div>
        </div>
        <label className="admin-orders-toolbar__field admin-orders-toolbar__field--grow">
          <span className="admin-orders-toolbar__label">Tìm mã giao dịch / mã đơn / mã TT</span>
          <input
            type="search"
            className="admin-orders-toolbar__input"
            placeholder="Ví dụ: VNPAY123 hoặc 42"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Tìm theo mã giao dịch hoặc số đơn"
          />
        </label>
        <button
          type="button"
          className="admin-btn admin-btn--secondary"
          onClick={() => {
            setQ("");
            setStatusFilter("all");
            setQuick("");
          }}
        >
          Xóa lọc
        </button>
      </div>

      <div className="admin-page__panel">
        {loading ? (
          <p className="admin-page__muted" style={{ margin: 0 }}>
            Đang tải…
          </p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Mã TT</th>
                  <th>Mã đơn</th>
                  <th>Khách</th>
                  <th>Phương thức</th>
                  <th>Mã giao dịch</th>
                  <th>Số tiền</th>
                  <th>Trạng thái GD</th>
                  <th>Thời gian TT</th>
                  <th>TT đơn</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="admin-page__muted">
                      Không có bản ghi thanh toán phù hợp.
                    </td>
                  </tr>
                ) : (
                  rows.map((p) => (
                    <tr key={p.payment_id}>
                      <td>#{p.payment_id}</td>
                      <td>
                        <strong>#{p.order?.order_id ?? p.order_id}</strong>
                      </td>
                      <td>
                        {p.order?.user?.full_name || "—"}
                        <br />
                        <span style={{ fontSize: "0.75rem", color: "#666" }}>{p.order?.user?.email || ""}</span>
                      </td>
                      <td style={{ fontSize: "0.85rem", maxWidth: 200 }}>
                        {payMethodLabel(p.payment_method)}
                        {p.payment_gateway ? (
                          <span className="admin-page__muted" style={{ display: "block", fontSize: "0.72rem" }}>
                            {p.payment_gateway}
                          </span>
                        ) : null}
                      </td>
                      <td style={{ fontFamily: "monospace", fontSize: "0.8rem", wordBreak: "break-all" }}>
                        {p.transaction_code || "—"}
                      </td>
                      <td>{money(displayAmount(p))}đ</td>
                      <td>
                        <span
                          className={`admin-badge ${
                            p.payment_status === "success" || p.payment_status === "paid"
                              ? "admin-badge--ok"
                              : p.payment_status === "failed"
                                ? "admin-badge--off"
                                : ""
                          }`}
                        >
                          {payRowStatusLabel(p.payment_status)}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.8rem" }}>
                        {p.is_abnormal ? (
                          <span className="admin-badge admin-badge--off" title="Đánh dấu bất thường">
                            Có
                          </span>
                        ) : (
                          <span className="admin-page__muted">—</span>
                        )}
                      </td>
                      <td
                        style={{
                          fontSize: "0.75rem",
                          maxWidth: 200,
                          wordBreak: "break-word",
                          color: p.error_code || p.buyer_message ? "#8b2942" : undefined
                        }}
                        title={p.buyer_message || ""}
                      >
                        {p.error_code ? (
                          <span style={{ fontFamily: "monospace" }}>{p.error_code}</span>
                        ) : null}
                        {p.error_code && p.buyer_message ? <br /> : null}
                        {p.buyer_message ? (
                          <span className="admin-page__muted">{p.buyer_message}</span>
                        ) : !p.error_code ? (
                          "—"
                        ) : null}
                      </td>
                      <td style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                        {p.paid_at ? fmtDt(p.paid_at) : "—"}
                      </td>
                      <td style={{ fontSize: "0.85rem" }}>{orderPayLabel(p.order?.payment_status)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button type="button" className="admin-btn admin-btn--sm" onClick={() => openDetail(p.payment_id)}>
                          Chi tiết
                        </button>{" "}
                        <button type="button" className="admin-btn admin-btn--sm admin-btn--secondary" onClick={() => openEdit(p)}>
                          Đối soát
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {edit ? (
        <div className="admin-modal-backdrop" role="presentation" onClick={closeEdit}>
          <div
            className="admin-modal"
            role="dialog"
            aria-labelledby="admin-payment-edit-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className="admin-modal__close" aria-label="Đóng" onClick={closeEdit}>
              ×
            </button>
            <h2 id="admin-payment-edit-title" className="admin-modal__title">
              Đối soát thanh toán #{edit.payment_id} — đơn #{edit.order_id}
            </h2>
            <p className="admin-page__muted" style={{ marginTop: 0 }}>
              Cập nhật dữ liệu đã lưu (mã giao dịch, số tiền, thời điểm, trạng thái). Không thực hiện giao dịch mới trên cổng
              tại đây.
            </p>
            <div className="admin-order-detail__grid" style={{ marginTop: "1rem" }}>
              <label className="admin-order-detail__inline-label" style={{ flexDirection: "column", alignItems: "stretch" }}>
                Trạng thái giao dịch
                <select
                  value={form.payment_status}
                  onChange={(e) => setForm((f) => ({ ...f, payment_status: e.target.value }))}
                  style={{ marginTop: 6 }}
                >
                  <option value="pending">pending</option>
                  <option value="success">success</option>
                  <option value="failed">failed</option>
                  <option value="paid">paid</option>
                </select>
              </label>
              <label className="admin-order-detail__inline-label" style={{ flexDirection: "column", alignItems: "stretch" }}>
                Mã giao dịch
                <input
                  type="text"
                  value={form.transaction_code}
                  onChange={(e) => setForm((f) => ({ ...f, transaction_code: e.target.value }))}
                  placeholder="Mã giao dịch từ cổng / ngân hàng"
                  style={{ marginTop: 6 }}
                />
              </label>
              <label className="admin-order-detail__inline-label" style={{ flexDirection: "column", alignItems: "stretch" }}>
                Số tiền đã thu (đ)
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.paid_amount}
                  onChange={(e) => setForm((f) => ({ ...f, paid_amount: e.target.value }))}
                  placeholder="Để trống nếu chưa xác định"
                  style={{ marginTop: 6 }}
                />
              </label>
              <label className="admin-order-detail__inline-label" style={{ flexDirection: "column", alignItems: "stretch" }}>
                Thời gian thanh toán
                <input
                  type="datetime-local"
                  value={form.paid_at}
                  onChange={(e) => setForm((f) => ({ ...f, paid_at: e.target.value }))}
                  style={{ marginTop: 6 }}
                />
              </label>
            </div>
            <div style={{ marginTop: "1.25rem", display: "flex", gap: "0.75rem" }}>
              <button type="button" className="admin-btn" disabled={saving} onClick={saveEdit}>
                {saving ? "Đang lưu…" : "Lưu đối soát"}
              </button>
              <button type="button" className="admin-btn admin-btn--secondary" disabled={saving} onClick={closeEdit}>
                Hủy
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {detailId ? (
        <div className="admin-modal-backdrop" role="presentation" onClick={closeDetail}>
          <div
            className="admin-modal admin-modal--order"
            role="dialog"
            aria-labelledby="admin-payment-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className="admin-modal__close" aria-label="Đóng" onClick={closeDetail}>
              ×
            </button>
            <h2 id="admin-payment-detail-title" className="admin-modal__title">
              Chi tiết thanh toán #{detailId}
            </h2>
            {detailLoading ? <p>Đang tải…</p> : null}
            {detailErr ? (
              <p className="admin-msg admin-msg--err" role="alert">
                {detailErr}
              </p>
            ) : null}
            {detail && !detailLoading ? (
              <div className="admin-order-detail">
                <div className="admin-order-detail__grid">
                  <div className="admin-order-detail__block">
                    <strong>Giao dịch</strong>
                    <ul className="admin-order-detail__list">
                      <li>
                        Phương thức: {payMethodLabel(detail.payment_method)}
                        {detail.payment_gateway ? ` · ${detail.payment_gateway}` : ""}
                      </li>
                      <li>Trạng thái GD: {payRowStatusLabel(detail.payment_status)}</li>
                      <li>Mã giao dịch: {detail.transaction_code || "—"}</li>
                      <li>
                        Số tiền: {money(displayAmount(detail))}đ
                        {detail.currency ? ` (${detail.currency})` : ""}
                      </li>
                      <li>Thời gian thanh toán: {detail.paid_at ? fmtDt(detail.paid_at) : "—"}</li>
                      {detail.is_abnormal ? (
                        <li style={{ color: "#8b2942" }}>
                          <strong>Bất thường:</strong> có — cần đối soát
                        </li>
                      ) : null}
                      {detail.error_code ? (
                        <li>
                          <strong>Mã lỗi:</strong>{" "}
                          <span style={{ fontFamily: "monospace" }}>{detail.error_code}</span>
                        </li>
                      ) : null}
                      {detail.buyer_message ? (
                        <li style={{ maxWidth: 480 }}>
                          <strong>Thông báo cho khách:</strong> {detail.buyer_message}
                        </li>
                      ) : null}
                      {detail.failure_reason ? (
                        <li style={{ color: "#b00020" }}>Lỗi / từ chối: {detail.failure_reason}</li>
                      ) : null}
                      {detail.refund_amount != null ? <li>Đã hoàn qua cổng: {money(detail.refund_amount)}đ</li> : null}
                    </ul>
                  </div>
                  <div className="admin-order-detail__block">
                    <strong>Đơn hàng #{detail.order?.order_id}</strong>
                    <ul className="admin-order-detail__list">
                      <li>Tổng đơn: {money(detail.order?.total_amount)}đ</li>
                      <li>TT đơn: {orderPayLabel(detail.order?.payment_status)}</li>
                      <li>
                        Khách: {detail.order?.user?.full_name} — {detail.order?.user?.email}
                        {detail.order?.user?.phone ? ` · ${detail.order.user.phone}` : ""}
                      </li>
                      <li>
                        <Link to="/admin/don-hang" className="admin-shell__link" style={{ fontSize: "0.9rem" }}>
                          Mở trang Đơn hàng
                        </Link>{" "}
                        <span className="admin-page__muted">(tìm #{detail.order?.order_id})</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {detail.order?.order_items?.length ? (
                  <div className="admin-order-detail__block">
                    <strong>Sản phẩm trong đơn</strong>
                    <ul className="admin-order-detail__list">
                      {detail.order.order_items.map((oi) => (
                        <li key={oi.order_item_id}>
                          {oi.product?.product_name || "SP"} × {oi.quantity} — {money(oi.line_total)}đ
                          {oi.product?.sku ? (
                            <span className="admin-page__muted" style={{ marginLeft: 6 }}>
                              {oi.product.sku}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {detail.order?.refund_requests?.length ? (
                  <div className="admin-order-detail__block">
                    <strong>Yêu cầu hoàn tiền</strong>
                    <ul className="admin-order-detail__list">
                      {detail.order.refund_requests.map((r) => (
                        <li key={r.refund_request_id}>
                          #{r.refund_request_id} · {r.refund_status} · {money(r.refund_amount)}đ
                        </li>
                      ))}
                    </ul>
                    <Link to="/admin/hoan-tien" className="admin-shell__link" style={{ fontSize: "0.9rem" }}>
                      Quản lý hoàn tiền
                    </Link>
                  </div>
                ) : null}

                {detail.payment_status_logs?.length ? (
                  <div className="admin-order-detail__block">
                    <strong>Nhật ký trạng thái</strong>
                    <ul className="admin-order-detail__list" style={{ fontSize: "0.85rem" }}>
                      {detail.payment_status_logs.map((log) => (
                        <li key={log.log_id}>
                          {fmtDt(log.created_at)} · {log.from_status ?? "∅"} → {log.to_status} ({log.source})
                          {log.note ? ` — ${log.note}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {detail.gateway_response != null ? (
                  <div className="admin-order-detail__block">
                    <strong>Phản hồi cổng (JSON)</strong>
                    <pre
                      style={{
                        fontSize: "0.72rem",
                        overflow: "auto",
                        maxHeight: 160,
                        background: "#f5f5f5",
                        padding: "0.5rem",
                        borderRadius: 4
                      }}
                    >
                      {typeof detail.gateway_response === "object"
                        ? JSON.stringify(detail.gateway_response, null, 2)
                        : String(detail.gateway_response)}
                    </pre>
                  </div>
                ) : null}

                {detail.order?.payments?.length > 1 ? (
                  <div className="admin-order-detail__block">
                    <strong>Các lần thanh toán cùng đơn</strong>
                    <ul className="admin-order-detail__list">
                      {detail.order.payments.map((op) => (
                        <li key={op.payment_id}>
                          #{op.payment_id} · {payRowStatusLabel(op.payment_status)} · {op.transaction_code || "—"}
                          {String(op.payment_id) === String(detail.payment_id) ? " (đang xem)" : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
