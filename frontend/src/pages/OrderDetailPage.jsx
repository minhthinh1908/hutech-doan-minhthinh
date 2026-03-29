import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiGet, apiPost } from "../api/client.js";
import BuyerSidebar from "../components/BuyerSidebar.jsx";
import "./BuyerPages.css";

function money(n) {
  return Number(n || 0).toLocaleString("vi-VN");
}

function orderStatusVi(s) {
  const m = {
    pending: "Chờ xử lý",
    confirmed: "Đã xác nhận",
    shipping: "Đang giao",
    processing: "Đang xử lý",
    shipped: "Đang giao (cũ)",
    completed: "Hoàn thành",
    cancelled: "Đã hủy"
  };
  return m[s] || s || "—";
}

function payStatusVi(s) {
  const m = {
    unpaid: "Chưa thanh toán",
    paid: "Đã thanh toán",
    pending: "Đang chờ",
    refunded: "Đã hoàn tiền"
  };
  return m[s] || s || "—";
}

function formatBhDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("vi-VN");
  } catch {
    return "—";
  }
}

function orderAllowsWarrantyActivation(orderStatus) {
  const s = String(orderStatus || "");
  return s === "completed" || s === "shipped";
}

const TRACK_LABELS = ["Chờ xử lý", "Đã xác nhận", "Đang giao", "Hoàn thành"];

/** Bậc tiến độ (0–3) để vẽ timeline — khớp Admin cập nhật order_status */
function statusLevel(status) {
  const s = String(status || "");
  if (s === "pending" || s === "processing") return 0;
  if (s === "confirmed") return 1;
  if (s === "shipping" || s === "shipped") return 2;
  if (s === "completed") return 3;
  return 0;
}

function OrderStatusTimeline({ status }) {
  const level = statusLevel(status);
  return (
    <ol className="buyer-order-track__steps">
      {TRACK_LABELS.map((label, i) => {
        const done = level === 3 || i < level;
        const current = i === level && level < 3;
        const upcoming = i > level && level < 3;
        return (
          <li
            key={label}
            className={`buyer-order-track__step${done ? " buyer-order-track__step--done" : ""}${current ? " buyer-order-track__step--current" : ""}${upcoming ? " buyer-order-track__step--upcoming" : ""}`}
          >
            <span className="buyer-order-track__dot" aria-hidden />
            <span className="buyer-order-track__label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

const PAY_METHODS = [
  { value: "cod", label: "Thanh toán khi nhận hàng (COD)" },
  { value: "bank_transfer", label: "Chuyển khoản ngân hàng" },
  { value: "payment_gateway", label: "Cổng thanh toán trực tuyến" }
];

function payMethodLabel(code) {
  const m = PAY_METHODS.find((x) => x.value === code);
  return m ? m.label : code || "—";
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [payMethod, setPayMethod] = useState("cod");
  const [payMsg, setPayMsg] = useState("");
  const [payErr, setPayErr] = useState("");
  const [paying, setPaying] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [refundBuyerNote, setRefundBuyerNote] = useState("");
  const [refundMsg, setRefundMsg] = useState("");
  const [refundErr, setRefundErr] = useState("");
  const [refunding, setRefunding] = useState(false);
  const [warrantyActivating, setWarrantyActivating] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const o = await apiGet(`/orders/${id}`);
        if (!cancelled) {
          setOrder(o);
        }
      } catch (e) {
        if (!cancelled) setErr(e.message || "Không tìm thấy đơn.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function submitPayment() {
    setPayMsg("");
    setPayErr("");
    setPaying(true);
    try {
      await apiPost(
        `/orders/${id}/payments`,
        { payment_method: payMethod },
        { auth: true }
      );
      if (payMethod === "payment_gateway") {
        setPayMsg(
          "Yêu cầu thanh toán đã ghi nhận. Hệ thống sẽ chuyển hướng tới cổng thanh toán (demo — Payment Gateway)."
        );
      } else {
        setPayMsg("Đã ghi nhận phương thức thanh toán. Trạng thái giao dịch: chờ xác nhận.");
      }
      const o = await apiGet(`/orders/${id}`);
      setOrder(o);
    } catch (e) {
      setPayErr(e.message || "Không tạo được thanh toán.");
    } finally {
      setPaying(false);
    }
  }

  async function submitRefund(e) {
    e.preventDefault();
    setRefundMsg("");
    setRefundErr("");
    setRefunding(true);
    try {
      await apiPost(
        `/refund-requests/orders/${id}`,
        {
          reason: refundReason.trim(),
          buyer_note: refundBuyerNote.trim() || undefined
        },
        { auth: true }
      );
      setRefundMsg("Đã gửi yêu cầu hoàn tiền / đổi trả.");
      setRefundReason("");
      setRefundBuyerNote("");
      const o = await apiGet(`/orders/${id}`);
      setOrder(o);
    } catch (e) {
      setRefundErr(e.message || "Gửi yêu cầu thất bại.");
    } finally {
      setRefunding(false);
    }
  }

  async function activateWarrantyLine(orderItemId) {
    if (!orderItemId) return;
    setWarrantyActivating(orderItemId);
    setErr("");
    try {
      await apiPost(`/warranties/activate/order-items/${orderItemId}`, {}, { auth: true });
      const o = await apiGet(`/orders/${id}`);
      setOrder(o);
    } catch (e) {
      setErr(e.message || "Không kích hoạt được bảo hành.");
    } finally {
      setWarrantyActivating(null);
    }
  }

  if (loading) {
    return (
      <div className="buyer-page container">
        <p>Đang tải đơn hàng…</p>
      </div>
    );
  }

  if (err || !order) {
    return (
      <div className="buyer-page container">
        <p className="buyer-msg buyer-msg--err">{err || "Không có dữ liệu."}</p>
        <Link to="/don-hang">← Danh sách đơn</Link>
      </div>
    );
  }

  const items = order.order_items || [];
  const payments = order.payments || [];

  return (
    <div className="buyer-page">
      <div className="buyer-page__hero">
        <div className="container">
          <h1 className="buyer-page__title">Đơn hàng #{order.order_id}</h1>
          <p className="buyer-page__sub">
            {orderStatusVi(order.order_status)} · {payStatusVi(order.payment_status)} — Trạng thái đơn do cửa hàng cập nhật
            (bạn chỉ xem).
          </p>
        </div>
      </div>
      <div className="container buyer-shell">
        <BuyerSidebar />
        <div className="buyer-panel">
          <p>
            <Link to="/don-hang">← Quay lại danh sách</Link>
          </p>

          <section className="buyer-order-track" aria-labelledby="order-track-heading">
            <h2 id="order-track-heading" className="buyer-order-track__title">
              Theo dõi trạng thái
            </h2>
            <p className="buyer-order-track__note">
              Trạng thái giao hàng (<strong>{orderStatusVi(order.order_status)}</strong>) do <strong>quản trị viên</strong> cập
              nhật tại Admin → Đơn hàng. Khách hàng <strong>không thể sửa</strong> trạng thái đơn; bạn chỉ theo dõi tại đây.
            </p>
            {order.order_status === "cancelled" ? (
              <p className="buyer-order-track__cancelled" role="status">
                Đơn này đã <strong>hủy</strong>. Không áp dụng tiến độ giao hàng bên dưới.
              </p>
            ) : (
              <OrderStatusTimeline status={order.order_status} />
            )}
          </section>

          <div className="buyer-checkout__row">
            <span>Tạm tính</span>
            <span>{money(order.subtotal)}đ</span>
          </div>
          <div className="buyer-checkout__row">
            <span>Giảm giá</span>
            <span>{money(order.discount_amount)}đ</span>
          </div>
          <div className="buyer-checkout__row">
            <strong>Tổng thanh toán</strong>
            <strong>{money(order.total_amount)}đ</strong>
          </div>

          <h3 style={{ marginTop: "1.25rem", fontSize: "1rem" }}>Sản phẩm</h3>
          <p className="buyer-muted" style={{ marginBottom: "0.65rem", maxWidth: 640 }}>
            Sản phẩm có bảo hành: sau khi nhận hàng và đơn ở trạng thái <strong>Hoàn thành</strong> hoặc{" "}
            <strong>Đã giao (shipped)</strong>, bấm <strong>Kích hoạt BH</strong> để bắt đầu tính thời hạn.
          </p>
          <div className="buyer-table-wrap">
            <table className="buyer-table">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th>SL</th>
                  <th>Đơn giá</th>
                  <th>Thành tiền</th>
                  <th>Bảo hành</th>
                </tr>
              </thead>
              <tbody>
                {items.map((line) => {
                  const months = Number(line.product?.warranty_months ?? 0);
                  const w = Array.isArray(line.warranties) ? line.warranties[0] : null;
                  const canAct =
                    months > 0 &&
                    w?.status === "pending" &&
                    orderAllowsWarrantyActivation(order.order_status);
                  return (
                    <tr key={line.order_item_id}>
                      <td>{line.product?.product_name || "—"}</td>
                      <td>{line.quantity}</td>
                      <td>{money(line.unit_price)}đ</td>
                      <td>{money(line.line_total)}đ</td>
                      <td style={{ minWidth: 140, fontSize: "0.88rem" }}>
                        {months <= 0 ? (
                          "—"
                        ) : !w ? (
                          "—"
                        ) : w.status === "pending" ? (
                          <span>
                            <span className="buyer-muted">Chờ kích hoạt</span>
                            {canAct ? (
                              <button
                                type="button"
                                className="buyer-btn buyer-btn--primary"
                                style={{ display: "block", marginTop: "0.35rem", fontSize: "0.82rem" }}
                                disabled={warrantyActivating === line.order_item_id}
                                onClick={() => activateWarrantyLine(line.order_item_id)}
                              >
                                {warrantyActivating === line.order_item_id ? "Đang gửi…" : "Kích hoạt BH"}
                              </button>
                            ) : (
                              <span className="buyer-muted" style={{ display: "block", marginTop: "0.25rem" }}>
                                Đợi đơn hoàn thành / đã giao
                              </span>
                            )}
                          </span>
                        ) : (
                          <span>
                            Đến {formatBhDate(w.end_date)}
                            {w.status === "active" ? (
                              <Link to="/bao-hanh" style={{ display: "block", marginTop: "0.25rem", fontSize: "0.82rem" }}>
                                Xem phiếu BH
                              </Link>
                            ) : null}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <section style={{ marginTop: "1.5rem" }} aria-labelledby="pay-h">
            <h3 id="pay-h" style={{ fontSize: "1rem" }}>
              Thanh toán
            </h3>
            <p className="buyer-muted" style={{ marginBottom: "0.75rem" }}>
              Chọn phương thức để ghi nhận giao dịch. Với cổng thanh toán, hệ thống sẽ tương tác với Payment Gateway (demo).
            </p>
            {payments.length > 0 ? (
              <ul className="buyer-muted" style={{ paddingLeft: "1.1rem" }}>
                {payments.map((p) => (
                  <li key={p.payment_id}>
                    #{p.payment_id} — {payMethodLabel(p.payment_method)} — {payStatusVi(p.payment_status)}
                    {p.paid_at ? ` — ${new Date(p.paid_at).toLocaleString("vi-VN")}` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="buyer-form__field" style={{ maxWidth: 400 }}>
              <span className="buyer-form__label">Phương thức</span>
              <select
                className="buyer-form__input"
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
              >
                {PAY_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            {payErr ? (
              <p className="buyer-msg buyer-msg--err" role="alert">
                {payErr}
              </p>
            ) : null}
            {payMsg ? (
              <p className="buyer-msg buyer-msg--ok" role="status">
                {payMsg}
              </p>
            ) : null}
            <button type="button" className="buyer-form__btn" style={{ marginTop: "0.5rem" }} disabled={paying} onClick={submitPayment}>
              {paying ? "Đang gửi…" : "Xác nhận thanh toán"}
            </button>
          </section>

          <section style={{ marginTop: "1.75rem" }} aria-labelledby="ref-h">
            <h3 id="ref-h" style={{ fontSize: "1rem" }}>
              Yêu cầu hoàn tiền / đổi trả
            </h3>
            <p className="buyer-muted" style={{ marginBottom: "0.75rem", maxWidth: 480 }}>
              Nhập lý do (bắt buộc). Cửa hàng sẽ xem xét và{" "}
              <strong>quyết định số tiền hoàn</strong> phù hợp (tối đa tổng đơn {money(order.total_amount)}đ).
            </p>
            {(order.refund_requests || []).length > 0 ? (
              <ul className="buyer-refund-list buyer-muted">
                {order.refund_requests.map((r) => (
                  <li key={r.refund_request_id} className="buyer-refund-list__item">
                    <strong>
                      {money(r.refund_amount)}đ — {r.refund_status}
                    </strong>
                    <div>
                      <span className="buyer-refund-list__label">Lý do:</span> {r.reason || "—"}
                    </div>
                    {r.buyer_note ? (
                      <div>
                        <span className="buyer-refund-list__label">Ghi chú của bạn:</span> {r.buyer_note}
                      </div>
                    ) : null}
                    {r.admin_note ? (
                      <div className="buyer-refund-list__admin">
                        <span className="buyer-refund-list__label">Phản hồi cửa hàng:</span> {r.admin_note}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            <form onSubmit={submitRefund} className="buyer-form" style={{ maxWidth: 480 }}>
              <label className="buyer-form__field">
                <span className="buyer-form__label">Lý do</span>
                <textarea
                  className="buyer-form__input"
                  style={{ minHeight: 88 }}
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  required
                />
              </label>
              <label className="buyer-form__field">
                <span className="buyer-form__label">Ghi chú thêm (tuỳ chọn)</span>
                <textarea
                  className="buyer-form__input"
                  style={{ minHeight: 64 }}
                  placeholder="Ví dụ: STK nhận hoàn, hình ảnh tem máy…"
                  value={refundBuyerNote}
                  onChange={(e) => setRefundBuyerNote(e.target.value)}
                />
              </label>
              {refundErr ? (
                <p className="buyer-msg buyer-msg--err" role="alert">
                  {refundErr}
                </p>
              ) : null}
              {refundMsg ? (
                <p className="buyer-msg buyer-msg--ok" role="status">
                  {refundMsg}
                </p>
              ) : null}
              <button type="submit" className="buyer-form__btn" disabled={refunding}>
                {refunding ? "Đang gửi…" : "Gửi yêu cầu"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
