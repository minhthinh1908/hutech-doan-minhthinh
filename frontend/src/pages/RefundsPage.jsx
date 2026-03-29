import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../api/client.js";
import BuyerSidebar from "../components/BuyerSidebar.jsx";
import "./BuyerPages.css";

function money(n) {
  return Number(n || 0).toLocaleString("vi-VN");
}

export default function RefundsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await apiGet("/refund-requests");
        if (!cancelled) setItems(Array.isArray(list) ? list : []);
      } catch (e) {
        if (!cancelled) setErr(e.message || "Không tải được danh sách.");
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
          <h1 className="buyer-page__title">Hoàn tiền / đổi trả</h1>
          <p className="buyer-page__sub">
            Danh sách yêu cầu hoàn tiền. Bạn có thể tạo yêu cầu mới trong chi tiết đơn hàng (
            <Link to="/don-hang">Request Refund</Link>).
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
          {!loading && items.length === 0 ? (
            <p className="buyer-muted">Chưa có yêu cầu hoàn tiền nào.</p>
          ) : null}
          {items.length > 0 ? (
            <div className="buyer-table-wrap">
              <table className="buyer-table">
                <thead>
                  <tr>
                    <th>Mã</th>
                    <th>Đơn hàng</th>
                    <th>Số tiền</th>
                    <th>Trạng thái</th>
                    <th>Ngày</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.refund_request_id}>
                      <td>#{r.refund_request_id}</td>
                      <td>
                        <Link to={`/don-hang/${r.order_id}`}>#{r.order_id}</Link>
                      </td>
                      <td>{money(r.refund_amount)}đ</td>
                      <td>{r.refund_status}</td>
                      <td>{r.request_date ? new Date(r.request_date).toLocaleString("vi-VN") : "—"}</td>
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
