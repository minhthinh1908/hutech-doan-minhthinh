import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const NAV = [
  { to: "/admin", end: true, label: "Tổng quan" },
  { to: "/admin/san-pham", label: "Sản phẩm" },
  { to: "/admin/danh-muc", label: "Danh mục" },
  { to: "/admin/thuong-hieu", label: "Thương hiệu" },
  { to: "/admin/voucher", label: "Khuyến mãi / Voucher" },
  { to: "/admin/don-hang", label: "Đơn hàng" },
  { to: "/admin/thanh-toan", label: "Thanh toán / Đối soát" },
  { to: "/admin/khach-hang", label: "Người dùng" },
  { to: "/admin/danh-gia", label: "Đánh giá" },
  { to: "/admin/bao-hanh", label: "Bảo hành" },
  { to: "/admin/sua-chua", label: "Sửa chữa" },
  { to: "/admin/hoan-tien", label: "Hoàn tiền" },
  { to: "/admin/bao-cao", label: "Báo cáo" },
  { to: "/admin/chan-trang", label: "Chân trang / Bản đồ" },
  { to: "/admin/trang-noi-dung", label: "Giới thiệu / Dịch vụ / Tin tức" },
];

export default function AdminShell() {
  const { logout, user } = useAuth();

  return (
    <div className="admin-layout min-h-screen bg-[#F5F5F5]">
      <header className="bg-[#1A1A1A] text-white border-b-4 border-[#FFC107] shadow-sm">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-8">
          <Link
            to="/admin"
            className="font-extrabold uppercase tracking-wide text-[#FFC107] no-underline transition-colors duration-200 hover:text-[#ffdb4d]"
          >
            Admin · E-commerce Tools
          </Link>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="text-white/90">{user?.full_name}</span>
            <Link to="/" className="text-white/90 underline decoration-white/40 underline-offset-2 transition-colors hover:text-white">
              Xem website
            </Link>
            <button
              type="button"
              className="rounded-lg bg-[#FFC107] px-4 py-2 font-semibold text-[#111111] shadow-sm transition-all duration-200 hover:bg-[#E6AC00] focus:outline-none focus:ring-2 focus:ring-[#FFC107] focus:ring-offset-2 focus:ring-offset-[#1A1A1A]"
              onClick={() => logout()}
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 py-6 md:flex-row md:px-8 md:py-8 lg:gap-8">
        <aside
          className="shrink-0 rounded-xl bg-[#1A1A1A] p-3 shadow-md md:w-64 lg:w-72 md:sticky md:top-6 md:self-start"
          aria-label="Menu quản trị"
        >
          <nav className="flex flex-col gap-1 max-md:flex-row max-md:flex-wrap max-md:gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    "block rounded-lg px-3 py-2.5 text-sm font-medium text-white/90 no-underline transition-all duration-200",
                    "hover:bg-white/10 hover:text-white",
                    "max-md:border max-md:border-transparent max-md:px-2.5 max-md:py-2",
                    isActive ? "bg-[#FFC107] font-semibold text-[#111111] shadow-sm hover:bg-[#E6AC00] hover:text-[#111111]" : "",
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="min-h-[min(70vh,640px)] min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
