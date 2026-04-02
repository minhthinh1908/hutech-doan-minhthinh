import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../api/client.js";
import BuyerSidebar from "../components/BuyerSidebar.jsx";
import { paymentStatusBuyerLabel } from "../utils/paymentStatusLabels.js";

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

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiGet("/orders");
        if (!cancelled) setOrders(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) setErr(e.message || "Không tải được đơn hàng.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="buyer-page">
      <div className="buyer-page__hero">
        <div className="container">
          <h1 className="buyer-page__title">Theo dõi đơn hàng</h1>
          <p className="buyer-page__sub">
            Danh sách đơn của bạn — xem trạng thái giao hàng và thanh toán. Trạng thái đơn do cửa hàng cập nhật (Admin); bạn
            chỉ xem, không chỉnh sửa.
          </p>
        </div>
      </div>
      <div className="container buyer-shell">
        <BuyerSidebar />
        <div className="buyer-panel">
          {loading ? <p>Đang tải…</p> : null}
          {err ? (
            <p className="buyer-msg buyer-msg--err" role="alert">
              {err}
            </p>
          ) : null}
          {!loading && orders.length === 0 ? (
            <p className="buyer-muted">Bạn chưa có đơn hàng nào. Sau khi đặt hàng, mã đơn và trạng thái sẽ hiển thị tại đây.</p>
          ) : null}
          {orders.length > 0 ? (
            <div className="buyer-table-wrap">
              <table className="buyer-table">
                <thead>
                  <tr>
                    <th>Mã đơn</th>
                    <th>Ngày</th>
                    <th>Tổng</th>
                    <th>Trạng thái đơn</th>
                    <th>Thanh toán</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.order_id}>
                      <td>#{o.order_id}</td>
                      <td>{o.order_date ? new Date(o.order_date).toLocaleString("vi-VN") : "—"}</td>
                      <td>{money(o.total_amount)}đ</td>
                      <td>{orderStatusVi(o.order_status)}</td>
                      <td>{paymentStatusBuyerLabel(o.payment_status)}</td>
                      <td>
                        <Link className="buyer-btn buyer-btn--primary" to={`/don-hang/${o.order_id}`}>
                          Chi tiết
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
