import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../api/client.js";
import BuyerSidebar from "../components/BuyerSidebar.jsx";
import { CoreMessage, CoreSpinner, CoreTable } from "../components/ui/index.js";

function money(n) {
  return Number(n || 0).toLocaleString("vi-VN");
}

function refundStatusVi(s) {
  const m = {
    pending: "Chờ xử lý",
    approved: "Đã duyệt",
    rejected: "Từ chối",
    completed: "Hoàn tất"
  };
  return m[s] || s || "—";
}

function clip(s, n = 100) {
  if (!s) return "—";
  const t = String(s).trim();
  return t.length <= n ? t : `${t.slice(0, n)}…`;
}

export default function RefundsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await apiGet("/refund-requests");
        if (!cancelled) setItems(Array.isArray(list) ? list : []);
      } catch (e) {
        if (!cancelled) setErr(e.message || "Không tải được danh sách.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refundColumns = useMemo(
    () => [
      { key: "rid", header: "Mã", field: "refund_request_id", body: (r) => `#${r.refund_request_id}` },
      {
        key: "oid",
        header: "Đơn hàng",
        field: "order_id",
        body: (r) => (
          <Link to={`/don-hang/${r.order_id}`}>#{r.order_id}</Link>
        )
      },
      {
        key: "amt",
        header: "Số tiền",
        field: "refund_amount",
        body: (r) => `${money(r.refund_amount)}đ`
      },
      { key: "st", header: "Trạng thái", field: "refund_status", body: (r) => refundStatusVi(r.refund_status) },
      {
        key: "rs",
        header: "Lý do",
        field: "reason",
        body: (r) => (
          <span style={{ maxWidth: 200, fontSize: "0.85rem", display: "inline-block" }} title={r.reason}>
            {clip(r.reason, 120)}
          </span>
        )
      },
      {
        key: "bn",
        header: "Ghi chú của bạn",
        field: "buyer_note",
        body: (r) => (
          <span style={{ maxWidth: 180, fontSize: "0.85rem", display: "inline-block" }} title={r.buyer_note || ""}>
            {r.buyer_note ? clip(r.buyer_note, 80) : "—"}
          </span>
        )
      },
      {
        key: "ad",
        header: "Phản hồi cửa hàng",
        field: "admin_note",
        body: (r) => (
          <span style={{ maxWidth: 200, fontSize: "0.85rem", color: "#1565c0", display: "inline-block" }} title={r.admin_note || ""}>
            {r.admin_note ? clip(r.admin_note, 100) : "—"}
          </span>
        )
      },
      {
        key: "dt",
        header: "Ngày",
        field: "request_date",
        body: (r) => (
          <span style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}>
            {r.request_date ? new Date(r.request_date).toLocaleString("vi-VN") : "—"}
          </span>
        )
      }
    ],
    []
  );

  return (
    <div className="buyer-page">
      <div className="buyer-page__hero">
        <div className="container">
          <h1 className="buyer-page__title">Hoàn tiền / đổi trả</h1>
          <p className="buyer-page__sub">
            Danh sách yêu cầu hoàn tiền, lý do, ghi chú của bạn và phản hồi từ cửa hàng. Tạo yêu cầu mới trong{" "}
            <Link to="/don-hang">chi tiết đơn hàng</Link>.
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
          {!loading && items.length === 0 ? (
            <p className="buyer-muted">Chưa có yêu cầu hoàn tiền nào.</p>
          ) : null}
          {items.length > 0 ? (
            <div className="buyer-table-wrap">
              <CoreTable
                value={items}
                dataKey="refund_request_id"
                columns={refundColumns}
                paginator={items.length > 15}
                rows={15}
                emptyMessage="Chưa có yêu cầu."
                tableStyle={{ minWidth: "1100px" }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
