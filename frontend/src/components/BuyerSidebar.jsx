import { NavLink } from "react-router-dom";

const links = [
  { to: "/tai-khoan", label: "Hồ sơ", end: true },
  { to: "/gio-hang", label: "Giỏ hàng", end: true },
  { to: "/don-hang", label: "Theo dõi đơn hàng", end: true },
  { to: "/bao-hanh", label: "Kích hoạt bảo hành", end: true },
  { to: "/sua-chua", label: "Yêu cầu sửa chữa", end: true },
  { to: "/hoan-tien", label: "Hoàn tiền / đổi trả", end: true }
];

export default function BuyerSidebar() {
  return (
    <nav className="buyer-nav" aria-label="Tài khoản khách hàng">
      {links.map(({ to, label, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? "buyer-nav__active" : undefined)}>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
