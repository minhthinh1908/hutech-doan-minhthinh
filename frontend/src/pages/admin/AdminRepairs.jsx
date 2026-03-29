import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPatch } from "../../api/client.js";
import "./AdminPages.css";

export default function AdminRepairs() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const data = await apiGet("/admin/repair-requests");
    setRows(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, [load]);

  async function setStatus(id, repair_status) {
    setErr("");
    try {
      await apiPatch(`/admin/repair-requests/${id}`, { repair_status });
      await load();
    } catch (e) {
      setErr(e.message || "Lỗi");
    }
  }

  return (
    <div className="admin-page">
      <h1>Yêu cầu sửa chữa</h1>
      <p className="admin-page__muted">Liên kết bảo hành — buyer gửi từ trang Sửa chữa.</p>
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
              <th>Mô tả</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.repair_request_id}>
                <td>{r.repair_request_id}</td>
                <td>{r.user?.full_name}</td>
                <td style={{ maxWidth: 280, fontSize: "0.8rem" }}>{r.issue_description}</td>
                <td>
                  <select value={r.repair_status} onChange={(e) => setStatus(r.repair_request_id, e.target.value)}>
                    <option value="pending">pending</option>
                    <option value="processing">processing</option>
                    <option value="completed">completed</option>
                    <option value="rejected">rejected</option>
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
