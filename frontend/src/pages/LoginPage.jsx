import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import "./AuthPages.css";

function redirectTarget(fromState) {
  if (fromState && typeof fromState === "object" && fromState.pathname) {
    return {
      pathname: fromState.pathname,
      search: fromState.search ?? "",
      hash: fromState.hash ?? ""
    };
  }
  return "/";
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fromState = location.state?.from;
  const guestMessage = location.state?.message;
  const toAfterLogin = redirectTarget(fromState);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(toAfterLogin, { replace: true });
    } catch (err) {
      setError(err.message || "Đăng nhập thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  const registerState = { from: fromState, message: guestMessage };

  return (
    <div className="auth-page">
      <div className="auth-page__hero">
        <div className="container">
          <h1 className="auth-page__title">Đăng nhập</h1>
          <p className="auth-page__lead">
            Khách xem sản phẩm không cần tài khoản. Đăng nhập để thêm giỏ hàng, đặt hàng và theo dõi đơn.
          </p>
        </div>
      </div>
      <div className="auth-page__box">
        <form className="auth-form" onSubmit={handleSubmit}>
          {guestMessage ? (
            <p className="auth-form__info" role="status">
              {guestMessage}
            </p>
          ) : null}
          {error ? <p className="auth-form__error">{error}</p> : null}
          <label className="auth-form__field">
            <span className="auth-form__label">Email</span>
            <input
              className="auth-form__input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="auth-form__field">
            <span className="auth-form__label">Mật khẩu</span>
            <input
              className="auth-form__input"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button type="submit" className="auth-form__btn" disabled={submitting}>
            {submitting ? "Đang xử lý…" : "Đăng nhập"}
          </button>
          <p className="auth-form__hint">
            Chưa có tài khoản?{" "}
            <Link to="/dang-ky" state={registerState}>
              Đăng ký tài khoản mới
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
