import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import "./AdminShell.css";

const NAV = [
  { to: "/admin", end: true, label: "Tổng quan" },
  { to: "/admin/san-pham", label: "Sản phẩm" },
  { to: "/admin/danh-muc", label: "Danh mục" },
  { to: "/admin/thuong-hieu", label: "Thương hiệu" },
  { to: "/admin/voucher", label: "Khuyến mãi / Voucher" },
  { to: "/admin/don-hang", label: "Đơn hàng" },
  { to: "/admin/khach-hang", label: "Khách hàng" },
  { to: "/admin/bao-hanh", label: "Bảo hành" },
  { to: "/admin/sua-chua", label: "Sửa chữa" },
  { to: "/admin/hoan-tien", label: "Hoàn tiền" },
  { to: "/admin/bao-cao", label: "Báo cáo" },
  { to: "/admin/chan-trang", label: "Chân trang / Bản đồ" }
];

export default function AdminShell() {
  const { logout, user } = useAuth();

  return (
    <div className="admin-shell">
      <header className="admin-shell__top">
        <div className="admin-shell__top-inner container">
          <Link to="/admin" className="admin-shell__brand">
            Admin · Bình Định Tools
          </Link>
          <div className="admin-shell__top-actions">
            <span className="admin-shell__user">{user?.full_name}</span>
            <Link to="/" className="admin-shell__link">
              Xem website
            </Link>
            <button type="button" className="admin-shell__logout" onClick={() => logout()}>
              Đăng xuất
            </button>
          </div>
        </div>
      </header>
      <div className="admin-shell__body container">
        <aside className="admin-shell__aside" aria-label="Menu quản trị">
          <nav className="admin-shell__nav">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `admin-shell__nav-link${isActive ? " admin-shell__nav-link--active" : ""}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="admin-shell__main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
