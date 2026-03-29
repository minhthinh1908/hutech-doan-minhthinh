import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPatch } from "../../api/client.js";
import {
  paymentStatusAdminLabel,
  paymentLogSourceLabel,
  PAYMENT_STATUS_OPTIONS
} from "../../utils/paymentStatusLabels.js";
import "./AdminPages.css";

function money(n) {
  return Number(n || 0).toLocaleString("vi-VN");
}

function fmtLogDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

/** Trạng thái chuẩn admin (đồng bộ use case) */
const ORDER_STATUS_OPTIONS = [
  { value: "pending", label: "Chờ xử lý" },
  { value: "confirmed", label: "Đã xác nhận" },
  { value: "shipping", label: "Đang giao" },
  { value: "completed", label: "Hoàn thành" },
  { value: "cancelled", label: "Đã hủy" }
];

function payMethodVi(code) {
  const m = { cod: "COD", bank_transfer: "Chuyển khoản", payment_gateway: "Cổng TT" };
  return m[code] || code || "—";
}

function statusLabel(value) {
  const o = ORDER_STATUS_OPTIONS.find((x) => x.value === value);
  if (o) return o.label;
  const legacy = { processing: "Đang xử lý (cũ)", shipped: "Đang giao (cũ)" };
  return legacy[value] || value || "—";
}

function selectOptionsForOrder(currentStatus) {
  const opts = [...ORDER_STATUS_OPTIONS];
  if (currentStatus && !opts.some((o) => o.value === currentStatus)) {
    opts.push({ value: currentStatus, label: `${currentStatus} (dữ liệu cũ)` });
  }
  return opts;
}

function selectOptionsForPayment(current) {
  const opts = [...PAYMENT_STATUS_OPTIONS];
  const c = current != null ? String(current) : "";
  if (c && !opts.some((o) => o.value === c)) {
    opts.unshift({ value: c, label: `${c} (dữ liệu cũ)` });
  }
  return opts;
}

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "Tất cả trạng thái" },
  ...ORDER_STATUS_OPTIONS,
  { value: "processing", label: "Đang xử lý (cũ)" },
  { value: "shipped", label: "Đang giao (cũ)" }
];

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  /** Ô nhập mã đơn (tức thời) */
  const [orderIdInput, setOrderIdInput] = useState("");
  /** Giá trị gửi API sau debounce */
  const [orderIdDebounced, setOrderIdDebounced] = useState("");
  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState("");

  useEffect(() => {
    const trimmed = orderIdInput.trim();
    if (!trimmed) {
      setOrderIdDebounced("");
      return undefined;
    }
    const t = setTimeout(() => setOrderIdDebounced(trimmed), 350);
    return () => clearTimeout(t);
  }, [orderIdInput]);

  const load = useCallback(async () => {
    const params = {};
    if (statusFilter && statusFilter !== "all") params.order_status = statusFilter;
    const q = orderIdDebounced.replace(/^#/, "");
    if (q) params.q = q;
    const data = await apiGet("/admin/orders", params);
    setOrders(Array.isArray(data) ? data : []);
  }, [statusFilter, orderIdDebounced]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        await load();
      } catch (e) {
        if (!cancelled) setErr(e.message || "Không tải được danh sách đơn.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function openDetail(orderId) {
    setDetailId(orderId);
    setDetail(null);
    setDetailErr("");
    setDetailLoading(true);
    try {
      const data = await apiGet(`/admin/orders/${orderId}`);
      setDetail(data);
    } catch (e) {
      setDetailErr(e.message || "Không tải chi tiết đơn.");
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setDetailId(null);
    setDetail(null);
    setDetailErr("");
  }

  async function setStatus(orderId, order_status) {
    setErr("");
    setMsg("");
    try {
      await apiPatch(`/admin/orders/${orderId}`, { order_status }, { auth: true });
      setMsg("Đã cập nhật trạng thái đơn.");
      await load();
      setDetail((d) =>
        d && String(d.order_id) === String(orderId) ? { ...d, order_status } : d
      );
    } catch (e) {
      setErr(e.message || "Lỗi cập nhật");
    }
  }

  async function setPaymentStatus(orderId, payment_status) {
    setErr("");
    setMsg("");
    try {
      await apiPatch(`/admin/orders/${orderId}`, { payment_status }, { auth: true });
      setMsg("Đã cập nhật trạng thái thanh toán.");
      await load();
      if (detailId === String(orderId)) {
        try {
          const data = await apiGet(`/admin/orders/${orderId}`);
          setDetail(data);
        } catch {
          setDetail((d) => (d ? { ...d, payment_status } : d));
        }
      }
    } catch (e) {
      setErr(e.message || "Không cập nhật được thanh toán.");
    }
  }

  return (
    <div className="admin-page">
      <h1>Đơn hàng</h1>
      <p className="admin-page__muted">
        Đơn từ khách đã đăng nhập — xem danh sách, chi tiết, <strong>trạng thái thanh toán</strong> (kể cả sau cổng
        thanh toán / webhook) và cập nhật trạng thái giao hàng (pending → confirmed → shipping → completed / cancelled).
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
          <span className="admin-orders-toolbar__label">Lọc theo trạng thái</span>
          <select
            className="admin-orders-toolbar__select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Lọc theo trạng thái đơn"
          >
            {STATUS_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-orders-toolbar__field admin-orders-toolbar__field--grow">
          <span className="admin-orders-toolbar__label">Tìm mã đơn</span>
          <input
            type="search"
            className="admin-orders-toolbar__input"
            placeholder="Ví dụ: 42 hoặc #42"
            value={orderIdInput}
            onChange={(e) => setOrderIdInput(e.target.value)}
            aria-label="Tìm theo mã đơn (số)"
          />
        </label>
        <button
          type="button"
          className="admin-btn admin-btn--secondary"
          onClick={() => {
            setStatusFilter("all");
            setOrderIdInput("");
          }}
        >
          Xóa lọc
        </button>
      </div>

      {loading ? (
        <p>Đang tải danh sách…</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Khách</th>
                <th>Tổng</th>
                <th>TT đơn</th>
                <th>TT thanh toán</th>
                <th>Ngày đặt</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="admin-page__muted">
                    {statusFilter !== "all" || orderIdDebounced
                      ? "Không có đơn phù hợp bộ lọc / mã đơn."
                      : "Chưa có đơn hàng nào."}
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.order_id}>
                    <td>#{o.order_id}</td>
                    <td>
                      {o.user?.full_name || "—"}
                      <br />
                      <span style={{ fontSize: "0.75rem", color: "#666" }}>{o.user?.email || ""}</span>
                    </td>
                    <td>{money(o.total_amount)}đ</td>
                    <td>
                      <select
                        className="admin-select--order-status"
                        value={o.order_status}
                        onChange={(e) => setStatus(o.order_id, e.target.value)}
                        aria-label="Trạng thái đơn"
                      >
                        {selectOptionsForOrder(o.order_status).map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="admin-select--order-status"
                        value={String(o.payment_status || "pending")}
                        onChange={(e) => setPaymentStatus(o.order_id, e.target.value)}
                        aria-label="Trạng thái thanh toán"
                      >
                        {PAYMENT_STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                      {o.order_date ? new Date(o.order_date).toLocaleString("vi-VN") : "—"}
                    </td>
                    <td>
                      <button type="button" className="admin-btn admin-btn--sm" onClick={() => openDetail(o.order_id)}>
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {detailId ? (
        <div className="admin-modal-backdrop" role="presentation" onClick={closeDetail}>
          <div
            className="admin-modal admin-modal--order"
            role="dialog"
            aria-labelledby="admin-order-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className="admin-modal__close" aria-label="Đóng" onClick={closeDetail}>
              ×
            </button>
            <h2 id="admin-order-detail-title" className="admin-modal__title">
              Chi tiết đơn #{detailId}
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
                  <div>
                    <strong>Khách</strong>
                    <p>
                      {detail.user?.full_name}
                      <br />
                      <span className="admin-page__muted">{detail.user?.email}</span>
                      {detail.user?.phone ? (
                        <>
                          <br />
                          <span className="admin-page__muted">{detail.user.phone}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  {detail.shipping_address ? (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <strong>Địa chỉ giao hàng</strong>
                      <p className="admin-page__muted" style={{ whiteSpace: "pre-wrap", margin: "0.35rem 0 0" }}>
                        {detail.shipping_address}
                      </p>
                    </div>
                  ) : null}
                  <div>
                    <strong>Trạng thái</strong>
                    <p>
                      Đơn: {statusLabel(detail.order_status)}
                      <br />
                      Thanh toán: {paymentStatusAdminLabel(detail.payment_status)}
                    </p>
                  </div>
                  <div>
                    <strong>Tổng tiền</strong>
                    <p>
                      Tạm tính: {money(detail.subtotal)}đ
                      <br />
                      Giảm giá: {money(detail.discount_amount)}đ
                      <br />
                      <strong>Thành tiền: {money(detail.total_amount)}đ</strong>
                    </p>
                  </div>
                  <div>
                    <strong>Ngày đặt</strong>
                    <p>{detail.order_date ? new Date(detail.order_date).toLocaleString("vi-VN") : "—"}</p>
                  </div>
                </div>

                {detail.order_vouchers?.length ? (
                  <div className="admin-order-detail__block">
                    <strong>Voucher</strong>
                    <ul className="admin-order-detail__list">
                      {detail.order_vouchers.map((ov) => (
                        <li key={ov.order_voucher_id}>
                          {ov.voucher?.code || "—"} — giảm {money(ov.discount_amount)}đ
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {detail.payments?.length ? (
                  <div className="admin-order-detail__block">
                    <strong>Lịch sử thanh toán (dữ liệu đã lưu)</strong>
                    <div className="admin-table-wrap" style={{ marginTop: "0.5rem" }}>
                      <table className="admin-table admin-table--compact">
                        <thead>
                          <tr>
                            <th>payment_method</th>
                            <th>payment_status</th>
                            <th>transaction_code</th>
                            <th>paid_amount</th>
                            <th>paid_at</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.payments.map((p) => (
                            <tr key={p.payment_id}>
                              <td>{payMethodVi(p.payment_method)}</td>
                              <td>{paymentStatusAdminLabel(p.payment_status)}</td>
                              <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                                {p.transaction_code || "—"}
                              </td>
                              <td>{p.paid_amount != null ? `${money(p.paid_amount)}đ` : "—"}</td>
                              <td style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                                {p.paid_at ? new Date(p.paid_at).toLocaleString("vi-VN") : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="admin-page__muted" style={{ margin: "0.5rem 0 0", fontSize: "0.8rem" }}>
                      Đối soát &amp; tra cứu toàn hệ thống: Admin → Thanh toán / Đối soát.
                    </p>
                  </div>
                ) : null}

                <div className="admin-order-detail__block">
                  <strong>Sản phẩm</strong>
                  <div className="admin-table-wrap">
                    <table className="admin-table admin-table--compact">
                      <thead>
                        <tr>
                          <th>Sản phẩm</th>
                          <th>SL</th>
                          <th>Đơn giá</th>
                          <th>Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detail.order_items || []).map((row) => (
                          <tr key={row.order_item_id}>
                            <td>{row.product?.product_name || `#${row.product_id}`}</td>
                            <td>{row.quantity}</td>
                            <td>{money(row.unit_price)}đ</td>
                            <td>{money(row.line_total)}đ</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="admin-order-detail__actions">
                  <label className="admin-order-detail__inline-label">
                    Đổi trạng thái đơn:
                    <select
                      value={detail.order_status}
                      onChange={(e) => {
                        const v = e.target.value;
                        setStatus(detail.order_id, v);
                      }}
                    >
                      {selectOptionsForOrder(detail.order_status).map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="admin-order-detail__inline-label">
                    Thanh toán (đơn):
                    <select
                      value={String(detail.payment_status || "pending")}
                      onChange={(e) => setPaymentStatus(detail.order_id, e.target.value)}
                    >
                      {selectOptionsForPayment(detail.payment_status).map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
