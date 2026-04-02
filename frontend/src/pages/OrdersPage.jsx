import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../api/client.js";
import BuyerSidebar from "../components/BuyerSidebar.jsx";
import { CoreMessage, CoreSpinner, CoreTable } from "../components/ui/index.js";
import { paymentStatusBuyerLabel } from "../utils/paymentStatusLabels.js";

function money(n) {
  return Number(n || 0).toLocaleString("vi-VN");
}

function orderStatusVi(s) {
  const m = {
    pending: "Chờ xử lý",
    confirmed: "Đã xác nhận",
    shipping: "Đang giao",
    processing: "Đang xử lý",
    shipped: "Đang giao (cũ)",
    completed: "Hoàn thành",
    cancelled: "Đã hủy"
  };
  return m[s] || s || "—";
}

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiGet("/orders");
        if (!cancelled) setOrders(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) setErr(e.message || "Không tải được đơn hàng.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const orderColumns = useMemo(
    () => [
      { key: "oid", header: "Mã đơn", field: "order_id", sortable: true, body: (row) => `#${row.order_id}` },
      {
        key: "dt",
        header: "Ngày",
        field: "order_date",
        sortable: true,
        body: (row) => (row.order_date ? new Date(row.order_date).toLocaleString("vi-VN") : "—")
      },
      {
        key: "tot",
        header: "Tổng",
        field: "total_amount",
        sortable: true,
        body: (row) => `${money(row.total_amount)}đ`
      },
      {
        key: "st",
        header: "Trạng thái đơn",
        field: "order_status",
        body: (row) => orderStatusVi(row.order_status)
      },
      {
        key: "pay",
        header: "Thanh toán",
        field: "payment_status",
        body: (row) => paymentStatusBuyerLabel(row.payment_status)
      },
      {
        key: "go",
        header: "",
        body: (row) => (
          <Link className="buyer-link-btn" to={`/don-hang/${row.order_id}`}>
            Chi tiết
          </Link>
        )
      }
    ],
    []
  );

  return (
    <div className="buyer-page">
      <div className="buyer-page__hero">
        <div className="container">
          <h1 className="buyer-page__title">Theo dõi đơn hàng</h1>
          <p className="buyer-page__sub">
            Danh sách đơn của bạn — xem trạng thái giao hàng và thanh toán. Trạng thái đơn do cửa hàng cập nhật (Admin); bạn
            chỉ xem, không chỉnh sửa.
          </p>
        </div>
      </div>
      <div className="container buyer-shell">
        <BuyerSidebar />
        <div className="buyer-panel">
          {loading ? (
            <div className="buyer-page__loading">
              <CoreSpinner style={{ width: "2.15rem", height: "2.15rem" }} strokeWidth="6" />
            </div>
          ) : null}
          {err ? <CoreMessage severity="error" text={err} /> : null}
          {!loading && orders.length === 0 ? (
            <p className="buyer-muted">Bạn chưa có đơn hàng nào. Sau khi đặt hàng, mã đơn và trạng thái sẽ hiển thị tại đây.</p>
          ) : null}
          {orders.length > 0 ? (
            <div className="buyer-table-wrap">
              <CoreTable
                value={orders}
                dataKey="order_id"
                columns={orderColumns}
                paginator={orders.length > 10}
                rows={10}
                emptyMessage="Không có đơn hàng."
                tableStyle={{ minWidth: "720px" }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
