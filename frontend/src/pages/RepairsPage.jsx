import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../api/client.js";
import BuyerSidebar from "../components/BuyerSidebar.jsx";
import "./BuyerPages.css";

function formatDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("vi-VN");
  } catch {
    return "—";
  }
}

export default function RepairsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setErr("");
    try {
      const list = await apiGet("/repair-requests");
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      setErr(e.message || "Không tải được danh sách.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onUp = () => load();
    window.addEventListener("bd-repair-updated", onUp);
    return () => window.removeEventListener("bd-repair-updated", onUp);
  }, [load]);

  return (
    <div className="buyer-page">
      <div className="buyer-page__hero">
        <div className="container">
          <h1 className="buyer-page__title">Yêu cầu sửa chữa</h1>
          <p className="buyer-page__sub">Theo dõi trạng thái yêu cầu bảo dưỡng / sửa chữa thiết bị.</p>
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
            <p className="buyer-muted">Chưa có yêu cầu nào. Tạo từ mục Bảo hành đã kích hoạt.</p>
          ) : null}
          {items.length > 0 ? (
            <div className="buyer-table-wrap">
              <table className="buyer-table">
                <thead>
                  <tr>
                    <th>Mã</th>
                    <th>Ngày gửi</th>
                    <th>Trạng thái</th>
                    <th>Mô tả</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.repair_request_id}>
                      <td>#{r.repair_request_id}</td>
                      <td>{formatDate(r.request_date)}</td>
                      <td>{r.repair_status}</td>
                      <td style={{ maxWidth: 280 }}>{r.issue_description}</td>
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
