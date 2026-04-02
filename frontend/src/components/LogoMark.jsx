/**
 * Logo dọc: nhà vàng + khoan & tia zigzag (khối trắng) — chữ E-commerce / TOOLS phía dưới
 */
export default function LogoMark() {
  return (
    <div className="logo-compact logo-compact--stacked">
      <svg
        className="logo-compact__icon"
        viewBox="0 0 100 56"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        {/* Nhà mái tam giác */}
        <path d="M10 56 V44 L50 12 L90 44 V56 H10 Z" fill="var(--bd-yellow, #ffcc00)" />
        {/* Khoan ngang (khối trắng) */}
        <rect x="22" y="46" width="30" height="8" rx="2" fill="#ffffff" />
        <rect x="26" y="40" width="9" height="9" rx="1.5" fill="#ffffff" />
        <rect x="52" y="46" width="14" height="8" rx="1.5" fill="#ffffff" />
        <rect x="66" y="47.5" width="14" height="5" rx="1" fill="#ffffff" />
        <circle cx="37" cy="50" r="2" fill="var(--bd-black, #0a0a0a)" />
        {/* Tia zigzag dưới đầu khoan */}
        <path
          d="M78 51 L82 47 L86 52 L90 48 L94 53"
          stroke="#ffffff"
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="logo-compact__words">
        <span className="logo-compact__line1">E-commerce</span>
        <span className="logo-compact__line2">TOOLS</span>
      </div>
    </div>
  );
}
