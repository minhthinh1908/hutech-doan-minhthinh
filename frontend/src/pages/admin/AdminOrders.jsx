import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPatch } from "../../api/client.js";
import "./AdminPages.css";

function money(n) {
  return Number(n || 0).toLocaleString("vi-VN");
}

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const data = await apiGet("/admin/orders");
    setOrders(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, [load]);

  async function setStatus(orderId, order_status) {
    setErr("");
    setMsg("");
    try {
      await apiPatch(`/admin/orders/${orderId}`, { order_status });
      setMsg("Đã cập nhật trạng thái.");
      await load();
    } catch (e) {
      setErr(e.message || "Lỗi");
    }
  }

  return (
    <div className="admin-page">
      <h1>Đơn hàng</h1>
      <p className="admin-page__muted">Đơn từ buyer — khách (guest) không đặt hàng qua API này nếu chưa đăng nhập.</p>
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
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Khách</th>
              <th>Tổng</th>
              <th>TT đơn</th>
              <th>TT thanh toán</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.order_id}>
                <td>{o.order_id}</td>
                <td>
                  {o.user?.full_name}
                  <br />
                  <span style={{ fontSize: "0.75rem", color: "#666" }}>{o.user?.email}</span>
                </td>
                <td>{money(o.total_amount)}đ</td>
                <td>
                  <select value={o.order_status} onChange={(e) => setStatus(o.order_id, e.target.value)}>
                    <option value="pending">pending</option>
                    <option value="processing">processing</option>
                    <option value="shipped">shipped</option>
                    <option value="completed">completed</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                </td>
                <td>{o.payment_status}</td>
                <td>
                  <Link to={`/don-hang/${o.order_id}`} style={{ fontSize: "0.85rem" }}>
                    Xem (buyer)
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
