import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import "./AuthPages.css";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnFrom = location.state?.from;
  const guestMessage = location.state?.message;

  const [full_name, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      await register({
        full_name: full_name.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || undefined,
        role_name: "buyer"
      });
      setSuccess("Đăng ký thành công. Chuyển tới đăng nhập…");
      setTimeout(() => {
        navigate("/dang-nhap", {
          replace: true,
          state: {
            from: returnFrom,
            message: "Đăng nhập bằng email vừa đăng ký để tiếp tục (giỏ hàng, đặt hàng)."
          }
        });
      }, 1200);
    } catch (err) {
      setError(err.message || "Đăng ký thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-page__hero">
        <div className="container">
          <h1 className="auth-page__title">Đăng ký tài khoản</h1>
          <p className="auth-page__lead">
            Tạo tài khoản buyer để thêm giỏ, áp dụng voucher và đặt hàng. Khách chỉ xem sản phẩm không cần đăng ký.
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
          {success ? <p className="auth-form__success">{success}</p> : null}
          <label className="auth-form__field">
            <span className="auth-form__label">Họ và tên *</span>
            <input
              className="auth-form__input"
              required
              value={full_name}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
            />
          </label>
          <label className="auth-form__field">
            <span className="auth-form__label">Email *</span>
            <input
              className="auth-form__input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label className="auth-form__field">
            <span className="auth-form__label">Mật khẩu *</span>
            <input
              className="auth-form__input"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label className="auth-form__field">
            <span className="auth-form__label">Điện thoại</span>
            <input
              className="auth-form__input"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />
          </label>
          <button type="submit" className="auth-form__btn" disabled={submitting}>
            {submitting ? "Đang gửi…" : "Đăng ký"}
          </button>
          <p className="auth-form__hint">
            Đã có tài khoản?{" "}
            <Link to="/dang-nhap" state={{ from: returnFrom, message: guestMessage }}>
              Đăng nhập
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
