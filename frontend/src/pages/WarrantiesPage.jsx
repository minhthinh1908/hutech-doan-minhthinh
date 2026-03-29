import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost, apiUploadFile } from "../api/client.js";
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

function dayStr(d) {
  try {
    return new Date(d).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function warrantyStatusVi(s) {
  const m = {
    pending: "Chờ kích hoạt",
    active: "Đang hiệu lực",
    expired: "Hết hạn",
    claimed: "Đã kích hoạt / yêu cầu",
    void: "Vô hiệu"
  };
  return m[s] || s;
}

function canActivateWarranty(w) {
  if (!w || w.status !== "pending") return false;
  const st = w.order_item?.order?.order_status;
  return st === "completed" || st === "shipped";
}

function canRequestRepair(w) {
  if (!w || w.status !== "active") return false;
  const end = dayStr(w.end_date);
  const today = dayStr(new Date());
  return end && today && end >= today;
}

export default function WarrantiesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [modal, setModal] = useState(null);
  const [issue, setIssue] = useState("");
  const [submitErr, setSubmitErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activating, setActivating] = useState(null);
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  const load = useCallback(async () => {
    setErr("");
    try {
      const list = await apiGet("/warranties");
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      setErr(e.message || "Không tải được danh sách bảo hành.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onUp = () => load();
    window.addEventListener("bd-repair-updated", onUp);
    return () => window.removeEventListener("bd-repair-updated", onUp);
  }, [load]);

  function onPickFiles(e) {
    const picked = Array.from(e.target.files || []).filter((f) => /^image\//i.test(f.type));
    e.target.value = "";
    setFiles((prev) => [...prev, ...picked].slice(0, 5));
  }

  function removeFile(i) {
    setFiles((prev) => prev.filter((_, j) => j !== i));
  }

  async function submitRepair(e) {
    e.preventDefault();
    if (!modal) return;
    setSubmitErr("");
    setSubmitting(true);
    try {
      const urls = [];
      for (const f of files) {
        const r = await apiUploadFile("/repair-requests/upload", f, { auth: true });
        if (r?.url) urls.push(r.url);
      }
      await apiPost(
        `/repair-requests/warranties/${modal}`,
        { issue_description: issue.trim(), attachment_urls: urls },
        { auth: true }
      );
      setModal(null);
      setIssue("");
      setFiles([]);
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
          <h1 className="buyer-page__title">Xem bảo hành</h1>
          <p className="buyer-page__sub">
            Sau khi <strong>nhận hàng</strong>, khi đơn ở trạng thái <strong>Hoàn thành / Đã giao</strong>, bạn bấm{" "}
            <strong>Kích hoạt bảo hành</strong> để bắt đầu tính thời hạn. Sau đó bạn có thể gửi yêu cầu sửa chữa trong thời
            gian hiệu lực.
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
            <p className="buyer-muted">
              Chưa có phiếu bảo hành. Chỉ các sản phẩm có ghi số tháng bảo hành mới tạo phiếu sau khi bạn đặt hàng thành công.
            </p>
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
                    <th>Đơn hàng</th>
                    <th>Số YC sửa</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((w) => {
                    const pname = w.order_item?.product?.product_name || "—";
                    const nReq = Array.isArray(w.repair_requests) ? w.repair_requests.length : 0;
                    const ok = canRequestRepair(w);
                    const oid = w.order_item?.order?.order_id;
                    const ostatus = w.order_item?.order?.order_status;
                    const canAct = canActivateWarranty(w);
                    const oiid = w.order_item_id;
                    return (
                      <tr key={w.warranty_id}>
                        <td>#{w.warranty_id}</td>
                        <td>{pname}</td>
                        <td>{w.start_date ? formatDate(w.start_date) : "—"}</td>
                        <td>{w.end_date ? formatDate(w.end_date) : "—"}</td>
                        <td>{warrantyStatusVi(w.status)}</td>
                        <td>
                          {oid ? (
                            <span title={ostatus || ""}>
                              #{oid}
                              {ostatus ? ` · ${ostatus}` : ""}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>{nReq}</td>
                        <td>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                            {w.status === "pending" ? (
                              <button
                                type="button"
                                className="buyer-btn buyer-btn--primary"
                                disabled={!canAct || activating === oiid}
                                title={
                                  canAct
                                    ? "Kích hoạt sau khi đã nhận hàng"
                                    : "Đợi đơn hoàn thành / đã giao (hoặc đã kích hoạt)"
                                }
                                onClick={() => canAct && activateWarranty(oiid)}
                              >
                                {activating === oiid ? "Đang gửi…" : "Kích hoạt BH"}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="buyer-btn buyer-btn--primary"
                              style={w.status === "pending" ? { opacity: 0.85 } : undefined}
                              disabled={!ok}
                              title={ok ? "Gửi yêu cầu sửa chữa" : "Cần kích hoạt BH và còn trong thời hạn"}
                              onClick={() => ok && setModal(w.warranty_id)}
                            >
                              Sửa chữa
                            </button>
                          </div>
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
            <h3 id="repair-title">Yêu cầu sửa chữa</h3>
            <form onSubmit={submitRepair}>
              <p className="buyer-muted" style={{ marginBottom: "0.5rem" }}>
                Mô tả lỗi / nhu cầu bảo dưỡng. Có thể đính kèm tối đa 5 ảnh (JPEG, PNG…).
              </p>
              <textarea value={issue} onChange={(e) => setIssue(e.target.value)} required placeholder="VD: Máy khoan chạy yếu, có tiếng kêu lạ…" />
              <div className="buyer-repair-upload">
                <input
                  className="buyer-repair-upload__input"
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  multiple
                  disabled={files.length >= 5}
                  onChange={onPickFiles}
                />
                {files.length > 0 ? (
                  <div className="buyer-repair-upload__previews">
                    {files.map((f, i) => (
                      <div key={`${f.name}-${i}`} className="buyer-repair-upload__thumb">
                        <img src={previews[i]} alt="" />
                        <button type="button" className="buyer-repair-upload__remove" onClick={() => removeFile(i)} aria-label="Xóa ảnh">
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
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
