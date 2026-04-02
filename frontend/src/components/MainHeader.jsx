import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useCartItemCount } from "../hooks/useCartItemCount.js";
import LogoMark from "./LogoMark.jsx";

function IconCart() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 7h15l-1.5 9h-12L6 7zm0 0L5 3H2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="20" r="1.5" fill="currentColor" />
      <circle cx="17" cy="20" r="1.5" fill="currentColor" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6.5 3h3l1 4.5-2 1.5a12 12 0 006 6l1.5-2 4.5 1v3a2 2 0 01-2 2C9.6 19 5 14.4 5 8.5a2 2 0 012-2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function MainHeader() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const { user, logout, loading } = useAuth();
  const cartCount = useCartItemCount();

  return (
    <header className="main-header">
      <div className="main-header__inner container">
        <Link to="/" className="main-header__logo" aria-label="Trang chủ E-commerce Tools">
          <span className="main-header__logo-led">
            <LogoMark />
          </span>
        </Link>

        <div className="main-header__search-wrap">
          <form
            className="main-header__search"
            onSubmit={(e) => {
              e.preventDefault();
              const query = q.trim();
              navigate(query ? `/san-pham?q=${encodeURIComponent(query)}` : "/san-pham");
            }}
          >
            <input
              type="search"
              className="main-header__input"
              placeholder="Nhập từ khóa"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Tìm kiếm sản phẩm"
            />
            <button type="submit" className="main-header__search-btn">
              Tìm kiếm
            </button>
          </form>
          <p className="main-header__hint">
            Xin vui lòng gõ từ khoá cần tìm, chúng tôi sẽ tìm giúp bạn !
          </p>
        </div>

        <div className="main-header__hotline">
          <p className="main-header__hotline-title">Hotline tư vấn</p>
          <div className="main-header__hotline-rows">
            <span className="main-header__hotline-icon" aria-hidden>
              <IconPhone />
            </span>
            <div className="main-header__hotline-lines">
              <div className="main-header__phone-row">
                <span>
                  CN 1{" "}
                  <a href="tel:0336634677" className="main-header__phone-num">
                    0336 634 677
                  </a>
                </span>
              </div>
              <div className="main-header__phone-row">
                <span>
                  CN HCM{" "}
                  <a href="tel:0981278914" className="main-header__phone-num">
                    0981 278 914
                  </a>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="main-header__account">
          {!loading && user ? (
            <>
              <span className="main-header__user" title={user.email}>
                Xin chào, <strong>{user.full_name || user.email}</strong>
              </span>
              <Link to="/tai-khoan" className="main-header__auth-link">
                Tài khoản
              </Link>
              {user.role_name === "admin" ? (
                <Link to="/admin" className="main-header__auth-link main-header__auth-link--emph">
                  Quản trị
                </Link>
              ) : null}
              <Link to="/don-hang" className="main-header__auth-link">
                Đơn hàng
              </Link>
              <button type="button" className="main-header__link-btn" onClick={() => logout()}>
                Đăng xuất
              </button>
            </>
          ) : (
            <>
              <Link to="/dang-nhap" className="main-header__auth-link">
                Đăng nhập
              </Link>
              <Link to="/dang-ky" className="main-header__auth-link main-header__auth-link--emph">
                Đăng ký
              </Link>
            </>
          )}
        </div>

        <Link to="/gio-hang" className="main-header__cart" id="cart">
          <span className="main-header__cart-icon">
            <IconCart />
          </span>
          <span className="main-header__cart-text">
            <span className="main-header__cart-label">Giỏ hàng</span>
            <span className="main-header__cart-count">
              <strong>({user ? cartCount : 0})</strong> sản phẩm
            </span>
          </span>
        </Link>
      </div>
    </header>
  );
}
