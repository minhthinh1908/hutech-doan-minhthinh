import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPatch } from "../../api/client.js";
import "./AdminPages.css";

export default function AdminWarranties() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const data = await apiGet("/admin/warranties");
    setRows(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, [load]);

  async function setStatus(id, status) {
    setErr("");
    try {
      await apiPatch(`/admin/warranties/${id}`, { status });
      await load();
    } catch (e) {
      setErr(e.message || "Lỗi");
    }
  }

  return (
    <div className="admin-page">
      <h1>Bảo hành</h1>
      <p className="admin-page__muted">Theo đơn hàng đã thanh toán / giao — liên kết với kích hoạt bảo hành phía buyer.</p>
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
              <th>Sản phẩm</th>
              <th>Đến</th>
              <th>TT</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => (
              <tr key={w.warranty_id}>
                <td>{w.warranty_id}</td>
                <td>{w.user?.full_name}</td>
                <td>{w.order_item?.product?.product_name}</td>
                <td>{w.end_date?.slice?.(0, 10)}</td>
                <td>
                  <select value={w.status} onChange={(e) => setStatus(w.warranty_id, e.target.value)}>
                    <option value="active">active</option>
                    <option value="expired">expired</option>
                    <option value="void">void</option>
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
