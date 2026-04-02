import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../../api/client.js";
import { CoreCard, CoreSkeleton } from "../../components/ui/index.js";
import useAdminToastNotices from "../../hooks/useAdminToastNotices.js";

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  useAdminToastNotices({ err, setErr });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await apiGet("/admin/dashboard");
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled) setErr(e.message || "Không tải được dữ liệu.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="admin-page">
      <h1 className="admin-section-title">Bảng điều khiển</h1>
      <p className="admin-lead mt-2">
        Quản lý sản phẩm, voucher và đơn hàng — dữ liệu hiển thị cho khách (guest) và buyer trên trang mua sắm.
      </p>
      {data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-4">
          <CoreCard className="text-center">
            <div className="text-3xl font-extrabold">{data.users}</div>
            <div className="text-xs uppercase tracking-wide mt-1 text-[#666]">Tài khoản</div>
          </CoreCard>
          <CoreCard className="text-center">
            <div className="text-3xl font-extrabold">{data.products}</div>
            <div className="text-xs uppercase tracking-wide mt-1 text-[#666]">Sản phẩm</div>
          </CoreCard>
          <CoreCard className="text-center">
            <div className="text-3xl font-extrabold">{data.orders}</div>
            <div className="text-xs uppercase tracking-wide mt-1 text-[#666]">Đơn hàng</div>
          </CoreCard>
          <CoreCard className="text-center">
            <div className="text-3xl font-extrabold">{data.pending_orders}</div>
            <div className="text-xs uppercase tracking-wide mt-1 text-[#666]">Chờ xử lý</div>
          </CoreCard>
          <CoreCard className="text-center">
            <div className="text-3xl font-extrabold">{data.active_vouchers}</div>
            <div className="text-xs uppercase tracking-wide mt-1 text-[#666]">Voucher hoạt động</div>
          </CoreCard>
        </div>
      ) : !err ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <CoreCard key={i} className="text-center">
              <CoreSkeleton width="60%" height="2.1rem" className="mx-auto" />
              <CoreSkeleton width="70%" height="0.8rem" className="mt-3 mx-auto" />
            </CoreCard>
          ))}
        </div>
      ) : null}
      <p className="text-sm text-[#666] mt-4">
        <Link to="/admin/san-pham">Đăng máy / sản phẩm</Link> · <Link to="/admin/voucher">Tạo mã giảm giá</Link> ·{" "}
        <Link to="/">Trang chủ khách</Link>
      </p>
    </div>
  );
}
