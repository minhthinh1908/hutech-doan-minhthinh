import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiDelete, apiGet, apiPatch } from "../../api/client.js";
import "./AdminPages.css";

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("vi-VN", {
      dateStyle: "short",
      timeStyle: "short"
    });
  } catch {
    return String(iso);
  }
}

function clip(s, n = 120) {
  if (!s) return "—";
  const t = String(s).trim();
  return t.length <= n ? t : `${t.slice(0, n)}…`;
}

function stars(n) {
  const r = Math.min(5, Math.max(0, Number(n) || 0));
  return `${"★".repeat(r)}${"☆".repeat(5 - r)}`;
}

/** Đồng bộ với backend moderation_status */
const MOD_STATUS_OPTIONS = [
  { value: "pending", label: "Chờ duyệt" },
  { value: "approved", label: "Đã duyệt" },
  { value: "rejected", label: "Từ chối / ẩn" }
];

const FILTER_OPTIONS = [{ value: "all", label: "Tất cả" }, ...MOD_STATUS_OPTIONS];

function statusLabel(value) {
  const o = MOD_STATUS_OPTIONS.find((x) => x.value === value);
  return o ? o.label : value || "—";
}

export default function AdminReviews() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async () => {
    const data = await apiGet("/admin/reviews");
    setRows(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        await load();
      } catch (e) {
        if (!cancelled) setErr(e.message || "Không tải được danh sách.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const filteredRows = useMemo(() => {
    if (statusFilter === "all") return rows;
    return rows.filter((r) => (r.moderation_status || "approved") === statusFilter);
  }, [rows, statusFilter]);

  async function setStatus(reviewId, moderation_status, confirmMsg) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setErr("");
    setMsg("");
    try {
      await apiPatch(`/admin/reviews/${reviewId}`, { moderation_status });
      setMsg(`Đã cập nhật: ${statusLabel(moderation_status)}.`);
      await load();
    } catch (e) {
      setErr(e.message || "Không cập nhật được.");
    }
  }

  async function onSelectChange(id, next) {
    await setStatus(id, next, null);
  }

  async function removeReview(reviewId) {
    if (!window.confirm("Xóa đánh giá này? (kèm bình luận con)")) return;
    setErr("");
    setMsg("");
    try {
      await apiDelete(`/admin/reviews/${reviewId}`);
      setMsg("Đã xóa đánh giá.");
      await load();
    } catch (e) {
      setErr(e.message || "Lỗi");
    }
  }

  async function removeComment(commentId) {
    if (!window.confirm("Xóa bình luận này?")) return;
    setErr("");
    setMsg("");
    try {
      await apiDelete(`/admin/review-comments/${commentId}`);
      setMsg("Đã xóa bình luận.");
      await load();
    } catch (e) {
      setErr(e.message || "Lỗi");
    }
  }

  return (
    <div className="admin-page">
      <h1>Đánh giá</h1>
      <p className="admin-page__muted">
        Xem đánh giá từ khách, <strong>duyệt</strong> hoặc <strong>ẩn</strong> nội dung không phù hợp, xóa đánh giá hoặc
        bình luận. Khách chưa đăng nhập chỉ thấy đánh giá đã duyệt trên trang sản phẩm.
      </p>

      <div style={{ marginBottom: "1rem", display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: 0 }}>
          <span className="admin-page__muted" style={{ fontSize: "0.9rem" }}>
            Lọc:
          </span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="admin-select--order-status"
            style={{ minWidth: "12rem" }}
          >
            {FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <span className="admin-page__muted" style={{ fontSize: "0.85rem" }}>
          Hiển thị {filteredRows.length} / {rows.length} đánh giá
        </span>
      </div>

      {err ? (
        <p className="admin-msg admin-msg--err" role="alert">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="admin-msg admin-msg--ok" role="status">
          {msg}
        </p>
      ) : null}

      {loading ? (
        <p>Đang tải…</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Ngày gửi</th>
                <th>Sản phẩm</th>
                <th>Khách</th>
                <th>Email</th>
                <th>Điểm</th>
                <th>Nội dung</th>
                <th>Trạng thái</th>
                <th>Bình luận</th>
                <th>Duyệt / Từ chối / Cập nhật</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: "center", color: "#666" }}>
                    {rows.length === 0 ? "Chưa có đánh giá." : "Không có bản ghi khớp bộ lọc."}
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  const st = r.moderation_status || "approved";
                  const pending = st === "pending";
                  const approved = st === "approved";
                  return (
                    <tr key={r.review_id}>
                      <td>{r.review_id}</td>
                      <td style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>{fmtDate(r.created_at)}</td>
                      <td>
                        {r.product?.product_id ? (
                          <Link to={`/san-pham/${r.product.product_id}`} target="_blank" rel="noreferrer">
                            {r.product.product_name}
                          </Link>
                        ) : (
                          "—"
                        )}
                        <span className="admin-page__muted" style={{ display: "block", fontSize: "0.72rem" }}>
                          {r.product?.sku || ""}
                        </span>
                      </td>
                      <td>{r.user?.full_name || "—"}</td>
                      <td style={{ wordBreak: "break-all", fontSize: "0.8rem" }}>{r.user?.email || "—"}</td>
                      <td>
                        <span style={{ color: "#f5a623", letterSpacing: "0.05em" }} title={`${r.rating}/5`}>
                          {stars(r.rating)}
                        </span>
                        <span className="admin-page__muted" style={{ display: "block", fontSize: "0.72rem" }}>
                          {r.rating}/5
                        </span>
                      </td>
                      <td style={{ maxWidth: 220, fontSize: "0.8rem" }} title={r.comment || ""}>
                        {clip(r.comment, 160)}
                      </td>
                      <td>
                        <span
                          className={`admin-badge ${
                            st === "approved" ? "admin-badge--ok" : st === "rejected" ? "admin-badge--off" : ""
                          }`}
                        >
                          {statusLabel(st)}
                        </span>
                      </td>
                      <td style={{ maxWidth: 200, fontSize: "0.78rem", verticalAlign: "top" }}>
                        <div style={{ marginBottom: 4 }}>
                          <strong>{r._count?.comments ?? 0}</strong> bình luận
                        </div>
                        {(r.comments || []).slice(0, 3).map((c) => (
                          <div
                            key={c.review_comment_id}
                            style={{
                              borderLeft: "2px solid #e0e0e0",
                              paddingLeft: 6,
                              marginBottom: 6
                            }}
                          >
                            <span style={{ fontWeight: 700 }}>{c.user?.full_name}</span>
                            <span style={{ color: "#666", marginLeft: 4 }}>{clip(c.body, 60)}</span>
                            <button
                              type="button"
                              className="admin-inline-danger"
                              style={{ marginLeft: 6, fontSize: "0.7rem" }}
                              onClick={() => removeComment(c.review_comment_id)}
                            >
                              Xóa
                            </button>
                          </div>
                        ))}
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", minWidth: "11rem" }}>
                          <select
                            className="admin-select--order-status"
                            value={st}
                            onChange={(e) => onSelectChange(r.review_id, e.target.value)}
                            aria-label={`Trạng thái đánh giá #${r.review_id}`}
                          >
                            {MOD_STATUS_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                            {pending ? (
                              <>
                                <button
                                  type="button"
                                  className="admin-btn"
                                  style={{ padding: "0.25rem 0.45rem", fontSize: "0.75rem" }}
                                  onClick={() =>
                                    setStatus(
                                      r.review_id,
                                      "approved",
                                      `Duyệt hiển thị đánh giá #${r.review_id} trên website?`
                                    )
                                  }
                                >
                                  Duyệt
                                </button>
                                <button
                                  type="button"
                                  className="admin-btn admin-btn--danger"
                                  style={{ padding: "0.25rem 0.45rem", fontSize: "0.75rem" }}
                                  onClick={() =>
                                    setStatus(r.review_id, "rejected", `Ẩn đánh giá #${r.review_id}?`)
                                  }
                                >
                                  Từ chối
                                </button>
                              </>
                            ) : null}
                            {approved ? (
                              <button
                                type="button"
                                className="admin-btn admin-btn--danger"
                                style={{ padding: "0.25rem 0.45rem", fontSize: "0.75rem" }}
                                onClick={() =>
                                  setStatus(r.review_id, "rejected", `Ẩn đánh giá #${r.review_id} khỏi trang công khai?`)
                                }
                              >
                                Ẩn
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="admin-btn admin-btn--danger"
                              style={{ padding: "0.25rem 0.45rem", fontSize: "0.75rem" }}
                              onClick={() => removeReview(r.review_id)}
                            >
                              Xóa ĐG
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
