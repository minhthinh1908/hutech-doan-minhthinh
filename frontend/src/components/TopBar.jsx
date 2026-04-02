import { NavLink } from "react-router-dom";

/** Thứ tự giống mẫu: Trang chủ → Sản phẩm → … → Liên hệ */
const NAV_ITEMS = [
  { type: "route", label: "TRANG CHỦ", to: "/", end: true },
  { type: "route", label: "SẢN PHẨM", to: "/san-pham" },
  { type: "route", label: "GIỚI THIỆU", to: "/gioi-thieu" },
  { type: "route", label: "DỊCH VỤ", to: "/dich-vu" },
  { type: "route", label: "TIN TỨC", to: "/tin-tuc" },
  { type: "route", label: "LIÊN HỆ", to: "/lien-he" }
];

function navLinkClass({ isActive }) {
  return "top-bar__link" + (isActive ? " top-bar__link--active" : "");
}

/** Một chu kỳ: khẩu hiệu 1 → khẩu hiệu 2; lặp vô hạn (hai segment giống nhau = marquee khớp nối). */
const MARQUEE_PHRASE =
  "BẠN CẦN · CHÚNG TÔI CÓ · UY TÍN TẠO NÊN THƯƠNG HIỆU · ";

export default function TopBar() {
  return (
    <div className="top-bar">
      <div className="top-bar__inner container">
        <div className="top-bar__marquee-window" aria-hidden="true">
          <div className="top-bar__marquee-track">
            <span className="top-bar__marquee-segment">{MARQUEE_PHRASE}</span>
            <span className="top-bar__marquee-segment">{MARQUEE_PHRASE}</span>
          </div>
        </div>
        <span className="visually-hidden">
          Khẩu hiệu chạy liên tục: Bạn cần, chúng tôi có. Uy tín tạo nên thương hiệu.
        </span>
        <nav className="top-bar__nav" aria-label="Điều hướng phụ">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              className={navLinkClass}
              end={item.end}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
