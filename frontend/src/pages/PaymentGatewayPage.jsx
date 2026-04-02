import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { apiGet, apiPost } from "../api/client.js";
import { CoreButton, CoreMessage, CoreSpinner } from "../components/ui/index.js";

function money(n) {
  return Number(n || 0).toLocaleString("vi-VN");
}

export default function PaymentGatewayPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";
  const orderId = searchParams.get("orderId") || "";

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastMsg, setLastMsg] = useState("");
  const [lastErr, setLastErr] = useState("");

  const load = useCallback(async () => {
    if (!token) {
      setErr("Thiếu token thanh toán.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr("");
    try {
      const s = await apiGet("/payments/gateway/session", { token });
      setSession(s);
    } catch (e) {
      setErr(e.message || "Không tải được phiên thanh toán.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function complete(outcome) {
    setBusy(true);
    setLastMsg("");
    setLastErr("");
    try {
      const res = await apiPost(
        "/payments/gateway/complete",
        { token, outcome },
        { auth: true }
      );
      setLastMsg(res.message || "Đã cập nhật.");
      const oid = orderId || (session?.order_id != null ? String(session.order_id) : "");
      setTimeout(() => {
        navigate(oid ? `/don-hang/${oid}?payment=${encodeURIComponent(outcome)}` : "/don-hang", { replace: true });
      }, 400);
    } catch (e) {
      setLastErr(e.message || "Không gửi được kết quả.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="buyer-page container buyer-page__loading">
        <CoreSpinner style={{ width: "2.15rem", height: "2.15rem" }} strokeWidth="6" />
      </div>
    );
  }

  if (err || !session) {
    return (
      <div className="buyer-page container">
        <CoreMessage severity="error" text={err || "Không có dữ liệu phiên thanh toán."} />
        <p style={{ marginTop: "1rem" }}>
          <Link to={orderId ? `/don-hang/${orderId}` : "/don-hang"}>← Quay lại đơn hàng</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="buyer-page">
      <div className="buyer-page__hero">
        <div className="container">
          <h1 className="buyer-page__title">Cổng thanh toán (demo)</h1>
          <p className="buyer-page__sub">
            Mô phỏng Payment Gateway: chọn kết quả để hệ thống cập nhật <strong>đơn hàng</strong> và{" "}
            <strong>trạng thái thanh toán</strong> giống luồng thật (thành công / thất bại / hủy / chờ xác nhận).
          </p>
        </div>
      </div>
      <div className="container" style={{ maxWidth: 520, paddingBottom: "2rem" }}>
        <p className="buyer-muted" style={{ marginBottom: "1rem" }}>
          Đơn <strong>#{orderId || "—"}</strong> · Số tiền: <strong>{money(session.total_amount)}đ</strong>
        </p>
        <p className="buyer-muted" style={{ marginBottom: "1.25rem", fontSize: "0.92rem" }}>
          Trạng thái hiện tại: giao dịch <code>{session.payment_status}</code> · đơn{" "}
          <code>{session.order_payment_status}</code>
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <CoreButton type="button" tone="secondary" disabled={busy} onClick={() => complete("success")}>
            Thanh toán thành công
          </CoreButton>
          <CoreButton type="button" tone="ghost" disabled={busy} onClick={() => complete("failed")}>
            Thanh toán thất bại
          </CoreButton>
          <CoreButton type="button" tone="danger" disabled={busy} onClick={() => complete("cancelled")}>
            Hủy thanh toán
          </CoreButton>
          <CoreButton type="button" tone="ghost" disabled={busy} onClick={() => complete("pending")}>
            Chờ xác nhận (pending)
          </CoreButton>
        </div>

        {lastErr ? <CoreMessage severity="error" text={lastErr} className="buyer-pay-msg" /> : null}
        {lastMsg ? <CoreMessage severity="success" text={lastMsg} className="buyer-pay-msg" /> : null}

        <p style={{ marginTop: "1.5rem" }}>
          <Link to={orderId ? `/don-hang/${orderId}` : "/don-hang"}>← Quay lại đơn (không mô phỏng kết quả)</Link>
        </p>
      </div>
    </div>
  );
}
