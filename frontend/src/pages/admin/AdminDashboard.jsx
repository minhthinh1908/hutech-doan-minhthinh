import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../../api/client.js";
import "./AdminPages.css";

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await apiGet("/admin/dashboard");
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled) setErr(e.message || "Không tải được");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="admin-page">
      <h1>Bảng điều khiển</h1>
      <p className="admin-page__muted">
        Quản lý sản phẩm, voucher và đơn hàng — dữ liệu hiển thị cho khách (guest) và buyer trên trang mua sắm.
      </p>
      {err ? (
        <p className="admin-msg admin-msg--err" role="alert">
          {err}
        </p>
      ) : null}
      {data ? (
        <div className="admin-stats">
          <div className="admin-stat">
            <div className="admin-stat__val">{data.users}</div>
            <div className="admin-stat__label">Tài khoản</div>
          </div>
          <div className="admin-stat">
            <div className="admin-stat__val">{data.products}</div>
            <div className="admin-stat__label">Sản phẩm</div>
          </div>
          <div className="admin-stat">
            <div className="admin-stat__val">{data.orders}</div>
            <div className="admin-stat__label">Đơn hàng</div>
          </div>
          <div className="admin-stat">
            <div className="admin-stat__val">{data.pending_orders}</div>
            <div className="admin-stat__label">Chờ xử lý</div>
          </div>
          <div className="admin-stat">
            <div className="admin-stat__val">{data.active_vouchers}</div>
            <div className="admin-stat__label">Voucher hoạt động</div>
          </div>
        </div>
      ) : !err ? (
        <p>Đang tải…</p>
      ) : null}
      <p className="admin-page__muted">
        <Link to="/admin/san-pham">Đăng máy / sản phẩm</Link> · <Link to="/admin/voucher">Tạo mã giảm giá</Link> ·{" "}
        <Link to="/">Trang chủ khách</Link>
      </p>
    </div>
  );
}
