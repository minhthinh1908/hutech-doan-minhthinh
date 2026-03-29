import { useEffect, useState } from "react";
import { apiGet } from "../../api/client.js";
import "./AdminPages.css";

export default function AdminReports() {
  const [revenue, setRevenue] = useState(null);
  const [top, setTop] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [r, t] = await Promise.all([
          apiGet("/admin/reports/revenue", { groupBy: "day" }),
          apiGet("/admin/reports/top-products", { limit: 10 })
        ]);
        if (!cancelled) {
          setRevenue(r);
          setTop(t);
        }
      } catch (e) {
        if (!cancelled) setErr(e.message || "Lỗi");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="admin-page">
      <h1>Báo cáo</h1>
      <p className="admin-page__muted">Doanh thu (đơn có payment_status paid/success) và sản phẩm bán chạy.</p>
      {err ? (
        <p className="admin-msg admin-msg--err" role="alert">
          {err}
        </p>
      ) : null}

      <h2 style={{ fontSize: "1rem", marginTop: "1rem" }}>Doanh thu theo ngày (30 ngày gần nhất)</h2>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Kỳ</th>
              <th>Doanh thu</th>
            </tr>
          </thead>
          <tbody>
            {(revenue?.rows || []).map((row, i) => (
              <tr key={i}>
                <td>{String(row.bucket)}</td>
                <td>{row.revenue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: "1rem", marginTop: "1rem" }}>Top sản phẩm</h2>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Tên</th>
              <th>SL bán</th>
              <th>Doanh thu dòng</th>
            </tr>
          </thead>
          <tbody>
            {(top?.rows || []).map((row, i) => (
              <tr key={i}>
                <td>{row.product_name}</td>
                <td>{row.total_quantity}</td>
                <td>{row.total_sales}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
