import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function RequireAdmin({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-[#666666]">
        Đang kiểm tra quyền…
      </div>
    );
  }

  if (!user || user.role_name !== "admin") {
    return <Navigate to="/dang-nhap" state={{ from: location, needAdmin: true }} replace />;
  }

  return children;
}
