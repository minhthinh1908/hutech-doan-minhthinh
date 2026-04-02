import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiDelete, apiGet, apiPatch } from "../../api/client.js";
import { CoreBadge, CoreButton, CoreCard, CoreSpinner, CoreTable } from "../../components/ui/index.js";
import useAdminToastNotices from "../../hooks/useAdminToastNotices.js";

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
  useAdminToastNotices({ err, msg, setErr, setMsg });
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
        if (!cancelled) setErr(e.message || "Không tải được dữ liệu.");
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
      setErr(e.message || "Không cập nhật được dữ liệu.");
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
      setErr(e.message || "Không xóa được dữ liệu.");
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
      setErr(e.message || "Không xóa được dữ liệu.");
    }
  }

  return (
    <div className="admin-page">
      <h1 className="admin-section-title">Đánh giá sản phẩm</h1>
      <p className="admin-lead">
        Xem đánh giá từ khách, <strong>duyệt</strong> hoặc <strong>ẩn</strong> (từ chối hiển thị công khai),{" "}
        <strong>xóa</strong> đánh giá hoặc bình luận. Trên trang sản phẩm, khách chỉ thấy nội dung đã duyệt.
      </p>

      <CoreCard>
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <label className="flex items-center gap-2">
            <span className="text-xs font-extrabold uppercase tracking-wide text-[#666666]">Lọc</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="admin-form-control"
            >
              {FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <span className="text-sm text-[#666666]">
            Hiển thị {filteredRows.length} / {rows.length} đánh giá
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 py-10">
            <CoreSpinner />
            <span className="text-[#666666] font-semibold">Đang tải dữ liệu…</span>
          </div>
        ) : (
          <CoreTable
            value={filteredRows}
            dataKey="review_id"
            rows={10}
            emptyMessage={rows.length === 0 ? "Chưa có đánh giá." : "Không có bản ghi khớp bộ lọc."}
            actionConfig={{
              copyFields: [
                { label: "ID đánh giá", field: "review_id" },
                { label: "Email khách", value: (row) => row.user?.email || "" },
                { label: "Trạng thái", field: "moderation_status" },
              ],
              excel: { fileName: "admin-reviews.xlsx" },
            }}
            columns={[
              { key: "id", header: "ID", field: "review_id" },
              { key: "date", header: "Ngày gửi", body: (r) => fmtDate(r.created_at) },
              {
                key: "product",
                header: "Sản phẩm",
                body: (r) => (
                  <div>
                    {r.product?.product_id ? (
                      <Link to={`/san-pham/${r.product.product_id}`} target="_blank" rel="noreferrer">
                        {r.product.product_name}
                      </Link>
                    ) : (
                      "—"
                    )}
                    <div className="text-xs text-[#666666]">{r.product?.sku || ""}</div>
                  </div>
                ),
              },
              { key: "user", header: "Khách", body: (r) => r.user?.full_name || "—" },
              { key: "email", header: "Email", body: (r) => <span className="break-all text-sm">{r.user?.email || "—"}</span> },
              {
                key: "rating",
                header: "Điểm",
                body: (r) => (
                  <div>
                    <span className="tracking-wide text-[#f5a623]" title={`${r.rating}/5`}>
                      {stars(r.rating)}
                    </span>
                    <div className="text-xs text-[#666666]">{r.rating}/5</div>
                  </div>
                ),
              },
              { key: "content", header: "Nội dung", body: (r) => <span title={r.comment || ""}>{clip(r.comment, 160)}</span> },
              {
                key: "status",
                header: "Trạng thái",
                body: (r) => {
                  const st = r.moderation_status || "approved";
                  const tone = st === "approved" ? "success" : st === "rejected" ? "danger" : "warn";
                  return <CoreBadge value={statusLabel(st)} tone={tone} />;
                },
              },
              {
                key: "comments",
                header: "Bình luận",
                body: (r) => (
                  <div className="max-w-[260px] text-sm">
                    <div className="mb-1">
                      <strong>{r._count?.comments ?? 0}</strong> bình luận
                    </div>
                    {(r.comments || []).slice(0, 3).map((c) => (
                      <div key={c.review_comment_id} className="mb-2 border-l-2 border-[#E5E5E5] pl-2">
                        <span className="font-semibold">{c.user?.full_name}</span>
                        <span className="ml-1 text-[#666666]">{clip(c.body, 60)}</span>
                        <CoreButton
                          type="button"
                          tone="danger"
                          label="Xóa"
                          className="ml-2 !px-2 !py-1 !text-xs"
                          onClick={() => removeComment(c.review_comment_id)}
                        />
                      </div>
                    ))}
                  </div>
                ),
              },
              {
                key: "actions",
                header: "Duyệt / Từ chối / Cập nhật",
                body: (r) => {
                  const st = r.moderation_status || "approved";
                  const pending = st === "pending";
                  const approved = st === "approved";
                  return (
                    <div className="min-w-[12rem] space-y-2">
                      <select
                        className="admin-form-control w-full"
                        value={st}
                        onChange={(e) => onSelectChange(r.review_id, e.target.value)}
                      >
                        {MOD_STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <div className="flex flex-wrap gap-2">
                        {pending ? (
                          <>
                            <CoreButton
                              type="button"
                              label="Duyệt"
                              className="!px-2.5 !py-1 !text-xs"
                              onClick={() => setStatus(r.review_id, "approved", `Duyệt hiển thị đánh giá #${r.review_id} trên website?`)}
                            />
                            <CoreButton
                              type="button"
                              tone="danger"
                              label="Từ chối"
                              className="!px-2.5 !py-1 !text-xs"
                              onClick={() => setStatus(r.review_id, "rejected", `Ẩn đánh giá #${r.review_id}?`)}
                            />
                          </>
                        ) : null}
                        {approved ? (
                          <CoreButton
                            type="button"
                            tone="danger"
                            label="Ẩn"
                            className="!px-2.5 !py-1 !text-xs"
                            onClick={() => setStatus(r.review_id, "rejected", `Ẩn đánh giá #${r.review_id} khỏi trang công khai?`)}
                          />
                        ) : null}
                        <CoreButton
                          type="button"
                          tone="danger"
                          label="Xóa ĐG"
                          className="!px-2.5 !py-1 !text-xs"
                          onClick={() => removeReview(r.review_id)}
                        />
                      </div>
                    </div>
                  );
                },
              },
            ]}
          />
        )}
      </CoreCard>
    </div>
  );
}
