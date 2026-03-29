import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="buyer-page container">
        <p className="buyer-page__loading">Đang tải…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/dang-nhap"
        replace
        state={{
          from: location,
          message: "Đăng nhập hoặc đăng ký để xem giỏ hàng và đặt hàng."
        }}
      />
    );
  }

  return children;
}
