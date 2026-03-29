import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../api/client.js";
import BuyerSidebar from "../components/BuyerSidebar.jsx";
import "./BuyerPages.css";

function formatDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("vi-VN");
  } catch {
    return "—";
  }
}

export default function WarrantiesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [modal, setModal] = useState(null);
  const [issue, setIssue] = useState("");
  const [submitErr, setSubmitErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await apiGet("/warranties");
        if (!cancelled) setItems(Array.isArray(list) ? list : []);
      } catch (e) {
        if (!cancelled) setErr(e.message || "Không tải được danh sách bảo hành.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submitRepair(e) {
    e.preventDefault();
    if (!modal) return;
    setSubmitErr("");
    setSubmitting(true);
    try {
      await apiPost(`/repair-requests/warranties/${modal}`, { issue_description: issue.trim() }, { auth: true });
      setModal(null);
      setIssue("");
      window.dispatchEvent(new Event("bd-repair-updated"));
    } catch (ex) {
      setSubmitErr(ex.message || "Gửi thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="buyer-page">
      <div className="buyer-page__hero">
        <div className="container">
          <h1 className="buyer-page__title">Bảo hành đã kích hoạt</h1>
          <p className="buyer-page__sub">
            Khi đặt hàng thành công, sản phẩm có thời hạn bảo hành sẽ được kích hoạt tự động (Activate Warranty). Bạn có thể
            gửi yêu cầu sửa chữa từ đây.
          </p>
        </div>
      </div>
      <div className="container buyer-shell">
        <BuyerSidebar />
        <div className="buyer-panel">
          {loading ? <p>Đang tải…</p> : null}
          {err ? (
            <p className="buyer-msg buyer-msg--err" role="alert">
              {err}
            </p>
          ) : null}
          {!loading && items.length === 0 ? (
            <p className="buyer-muted">Chưa có phiếu bảo hành nào. Mua sản phẩm có bảo hành để được kích hoạt sau khi đặt hàng.</p>
          ) : null}
          {items.length > 0 ? (
            <div className="buyer-table-wrap">
              <table className="buyer-table">
                <thead>
                  <tr>
                    <th>Mã BH</th>
                    <th>Sản phẩm</th>
                    <th>Bắt đầu</th>
                    <th>Kết thúc</th>
                    <th>Trạng thái</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((w) => {
                    const pname = w.order_item?.product?.product_name || "—";
                    return (
                      <tr key={w.warranty_id}>
                        <td>#{w.warranty_id}</td>
                        <td>{pname}</td>
                        <td>{formatDate(w.start_date)}</td>
                        <td>{formatDate(w.end_date)}</td>
                        <td>{w.status}</td>
                        <td>
                          <button type="button" className="buyer-btn buyer-btn--primary" onClick={() => setModal(w.warranty_id)}>
                            Yêu cầu sửa chữa
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>

      {modal ? (
        <div className="buyer-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="repair-title">
          <div className="buyer-modal">
            <h3 id="repair-title">Yêu cầu sửa chữa (Request Repair)</h3>
            <form onSubmit={submitRepair}>
              <p className="buyer-muted" style={{ marginBottom: "0.5rem" }}>
                Mô tả lỗi / nhu cầu bảo dưỡng thiết bị.
              </p>
              <textarea value={issue} onChange={(e) => setIssue(e.target.value)} required placeholder="VD: Máy khoan chạy yếu, có tiếng kêu lạ…" />
              {submitErr ? (
                <p className="buyer-msg buyer-msg--err" role="alert">
                  {submitErr}
                </p>
              ) : null}
              <div className="buyer-actions">
                <button type="submit" className="buyer-form__btn" disabled={submitting}>
                  {submitting ? "Đang gửi…" : "Gửi yêu cầu"}
                </button>
                <button type="button" className="buyer-btn" onClick={() => setModal(null)}>
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
