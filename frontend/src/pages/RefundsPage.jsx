import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../api/client.js";
import BuyerSidebar from "../components/BuyerSidebar.jsx";
import "./BuyerPages.css";

function money(n) {
  return Number(n || 0).toLocaleString("vi-VN");
}

function refundStatusVi(s) {
  const m = {
    pending: "Chờ xử lý",
    approved: "Đã duyệt",
    rejected: "Từ chối",
    completed: "Hoàn tất"
  };
  return m[s] || s || "—";
}

function clip(s, n = 100) {
  if (!s) return "—";
  const t = String(s).trim();
  return t.length <= n ? t : `${t.slice(0, n)}…`;
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
            Danh sách yêu cầu hoàn tiền, lý do, ghi chú của bạn và phản hồi từ cửa hàng. Tạo yêu cầu mới trong{" "}
            <Link to="/don-hang">chi tiết đơn hàng</Link>.
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
                    <th>Lý do</th>
                    <th>Ghi chú của bạn</th>
                    <th>Phản hồi cửa hàng</th>
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
                      <td>{refundStatusVi(r.refund_status)}</td>
                      <td style={{ maxWidth: 200, fontSize: "0.85rem" }} title={r.reason}>
                        {clip(r.reason, 120)}
                      </td>
                      <td style={{ maxWidth: 180, fontSize: "0.85rem" }} title={r.buyer_note || ""}>
                        {r.buyer_note ? clip(r.buyer_note, 80) : "—"}
                      </td>
                      <td style={{ maxWidth: 200, fontSize: "0.85rem", color: "#1565c0" }} title={r.admin_note || ""}>
                        {r.admin_note ? clip(r.admin_note, 100) : "—"}
                      </td>
                      <td style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                        {r.request_date ? new Date(r.request_date).toLocaleString("vi-VN") : "—"}
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
