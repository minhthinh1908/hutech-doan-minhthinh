import "./FloatingWarranty.css";

function IconHeadset() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 3a7 7 0 00-7 7v1H4a2 2 0 00-2 2v4a2 2 0 002 2h2v-7a5 5 0 0110 0v7h2a2 2 0 002-2v-4a2 2 0 00-2-2h-1V10a7 7 0 00-7-7zm-5 11v5H5v-5h2zm12 0h2v5h-2v-5z" />
    </svg>
  );
}

export default function FloatingWarranty() {
  return (
    <div className="float-warranty-led-wrap">
      <a href="#warranty" className="float-warranty">
        <span className="float-warranty__icon" aria-hidden>
          <IconHeadset />
        </span>
        Dịch Vụ Bảo Hành
      </a>
    </div>
  );
}
