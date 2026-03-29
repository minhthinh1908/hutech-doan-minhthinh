import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPatch } from "../../api/client.js";
import "./AdminPages.css";

function money(n) {
  return Number(n || 0).toLocaleString("vi-VN");
}

export default function AdminRefunds() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const data = await apiGet("/admin/refund-requests");
    setRows(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, [load]);

  async function setStatus(id, refund_status) {
    setErr("");
    try {
      await apiPatch(`/admin/refund-requests/${id}`, { refund_status });
      await load();
    } catch (e) {
      setErr(e.message || "Lỗi");
    }
  }

  return (
    <div className="admin-page">
      <h1>Hoàn tiền</h1>
      <p className="admin-page__muted">Buyer yêu cầu hoàn — xử lý trạng thái tại đây.</p>
      {err ? (
        <p className="admin-msg admin-msg--err" role="alert">
          {err}
        </p>
      ) : null}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Khách</th>
              <th>Số tiền</th>
              <th>Lý do</th>
              <th>TT</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.refund_request_id}>
                <td>{r.refund_request_id}</td>
                <td>{r.user?.full_name}</td>
                <td>{money(r.refund_amount)}đ</td>
                <td style={{ maxWidth: 200, fontSize: "0.8rem" }}>{r.reason}</td>
                <td>
                  <select value={r.refund_status} onChange={(e) => setStatus(r.refund_request_id, e.target.value)}>
                    <option value="pending">pending</option>
                    <option value="approved">approved</option>
                    <option value="rejected">rejected</option>
                    <option value="completed">completed</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
