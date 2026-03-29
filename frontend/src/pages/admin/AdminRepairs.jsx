import { useEffect, useState } from "react";
import { apiGet, apiPatch } from "../../api/client.js";
import {
  REPAIR_PRIMARY_FLOW,
  REPAIR_STATUS_LABELS,
  REPAIR_STATUS_ORDER,
  repairBadgeClass,
  repairStatusLabel
} from "../../utils/repairStatusConfig.js";
import "./AdminPages.css";
import "./AdminRepairs.css";

function toDateInputValue(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function parseAttachments(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.filter((u) => typeof u === "string");
  return [];
}

export default function AdminRepairs() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [filters, setFilters] = useState({
    q: "",
    status: "",
    dateFrom: "",
    dateTo: "",
    warranty: "all"
  });

  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    repair_status: "pending",
    admin_notes: "",
    resolution_notes: "",
    expected_completion_date: ""
  });

  async function fetchList() {
    setErr("");
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filters.q.trim()) p.set("q", filters.q.trim());
      if (filters.status) p.set("status", filters.status);
      if (filters.dateFrom) p.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) p.set("dateTo", filters.dateTo);
      if (filters.warranty && filters.warranty !== "all") p.set("warranty", filters.warranty);
      const qs = p.toString();
      const data = await apiGet(`/admin/repair-requests${qs ? `?${qs}` : ""}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e.message || "Không tải được danh sách.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ tải lần đầu; các lần sau dùng nút Áp dụng / Xóa lọc
  }, []);

  const openDetail = async (id) => {
    setDetailId(id);
    setDetail(null);
    setDetailErr("");
    setDetailLoading(true);
    try {
      const d = await apiGet(`/admin/repair-requests/${id}`);
      setDetail(d);
      setForm({
        repair_status: d.repair_status || "pending",
        admin_notes: d.admin_notes || "",
        resolution_notes: d.resolution_notes || "",
        expected_completion_date: toDateInputValue(d.expected_completion_date)
      });
    } catch (e) {
      setDetailErr(e.message || "Không tải chi tiết.");
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailId(null);
    setDetail(null);
    setDetailErr("");
  };

  async function saveDetail(patch) {
    if (!detailId) return;
    setSaving(true);
    setDetailErr("");
    try {
      const body = {
        ...patch,
        ...(patch.expected_completion_date !== undefined
          ? {
              expected_completion_date: patch.expected_completion_date || null
            }
          : {})
      };
      const updated = await apiPatch(`/admin/repair-requests/${detailId}`, body);
      setDetail(updated);
      setForm({
        repair_status: updated.repair_status || "pending",
        admin_notes: updated.admin_notes || "",
        resolution_notes: updated.resolution_notes || "",
        expected_completion_date: toDateInputValue(updated.expected_completion_date)
      });
      await fetchList();
    } catch (e) {
      setDetailErr(e.message || "Lưu thất bại.");
    } finally {
      setSaving(false);
    }
  }

  async function submitForm(e) {
    e.preventDefault();
    await saveDetail({
      repair_status: form.repair_status,
      admin_notes: form.admin_notes,
      resolution_notes: form.resolution_notes,
      expected_completion_date: form.expected_completion_date || null
    });
  }

  function applyFilters(e) {
    e?.preventDefault();
    fetchList();
  }

  async function resetFiltersAndLoad() {
    setFilters({ q: "", status: "", dateFrom: "", dateTo: "", warranty: "all" });
    setErr("");
    setLoading(true);
    try {
      const data = await apiGet("/admin/repair-requests");
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e.message || "Không tải được danh sách.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!detailId) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") closeDetail();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailId]);

  return (
    <div className="admin-page admin-repairs">
      <h1>Yêu cầu sửa chữa</h1>
      <p className="admin-page__muted">
        Tiếp nhận và xử lý yêu cầu từ khách (trang «Xem bảo hành»). Luồng trạng thái chính:{" "}
        {REPAIR_PRIMARY_FLOW.map((s) => REPAIR_STATUS_LABELS[s]).join(" → ")}. Tìm kiếm, lọc và mở chi tiết để cập nhật
        trạng thái và ghi chú xử lý.
      </p>

      <form className="admin-repairs__toolbar" onSubmit={applyFilters}>
        <div className="admin-repairs__field admin-repairs__field--search">
          <span className="admin-repairs__label">Tìm kiếm</span>
          <input
            className="admin-repairs__input"
            placeholder="Mã YC, tên, email, sản phẩm, mô tả…"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          />
        </div>
        <div className="admin-repairs__field">
          <span className="admin-repairs__label">Trạng thái</span>
          <select
            className="admin-repairs__select"
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="">Tất cả</option>
            {REPAIR_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {REPAIR_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-repairs__field">
          <span className="admin-repairs__label">Từ ngày</span>
          <input
            type="date"
            className="admin-repairs__input"
            value={filters.dateFrom}
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
          />
        </div>
        <div className="admin-repairs__field">
          <span className="admin-repairs__label">Đến ngày</span>
          <input
            type="date"
            className="admin-repairs__input"
            value={filters.dateTo}
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
          />
        </div>
        <div className="admin-repairs__field">
          <span className="admin-repairs__label">Bảo hành</span>
          <select
            className="admin-repairs__select"
            value={filters.warranty}
            onChange={(e) => setFilters((f) => ({ ...f, warranty: e.target.value }))}
          >
            <option value="all">Tất cả</option>
            <option value="active">Còn hiệu lực</option>
            <option value="expired">Hết hạn / không còn</option>
          </select>
        </div>
        <div className="admin-repairs__actions">
          <button type="submit" className="admin-repairs__btn admin-repairs__btn--primary">
            Áp dụng
          </button>
          <button type="button" className="admin-repairs__btn admin-repairs__btn--ghost" onClick={() => resetFiltersAndLoad()}>
            Xóa lọc
          </button>
        </div>
      </form>

      {err ? (
        <p className="admin-msg admin-msg--err" role="alert">
          {err}
        </p>
      ) : null}

      {loading ? <div className="admin-repairs__loading">Đang tải danh sách…</div> : null}

      {!loading && rows.length === 0 ? (
        <div className="admin-repairs__empty">Không có yêu cầu sửa chữa nào khớp bộ lọc.</div>
      ) : null}

      {!loading && rows.length > 0 ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Khách hàng</th>
                <th>Sản phẩm</th>
                <th>Mã bảo hành</th>
                <th>Ngày gửi</th>
                <th>Trạng thái</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.repair_request_id}>
                  <td>{r.repair_request_id}</td>
                  <td>
                    <div>{r.user?.full_name || "—"}</div>
                    <div style={{ fontSize: "0.75rem", color: "#666" }}>{r.user?.email || ""}</div>
                  </td>
                  <td>{r.warranty?.order_item?.product?.product_name || "—"}</td>
                  <td>{r.warranty_id}</td>
                  <td>{r.request_date?.slice?.(0, 10) || "—"}</td>
                  <td>
                    <span className={repairBadgeClass(r.repair_status)}>{repairStatusLabel(r.repair_status)}</span>
                  </td>
                  <td>
                    <div className="admin-repairs__table-actions">
                      <button type="button" className="admin-repairs__link-btn" onClick={() => openDetail(r.repair_request_id)}>
                        Chi tiết
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {detailId ? (
        <div className="admin-repairs-drawer__backdrop" role="presentation" onClick={(e) => e.target === e.currentTarget && closeDetail()}>
          <aside className="admin-repairs-drawer" role="dialog" aria-modal="true" aria-labelledby="admin-repair-drawer-title" onClick={(e) => e.stopPropagation()}>
            <div className="admin-repairs-drawer__head">
              <h2 id="admin-repair-drawer-title">Chi tiết yêu cầu #{detailId}</h2>
              <button type="button" className="admin-repairs-drawer__close" onClick={closeDetail} aria-label="Đóng">
                ×
              </button>
            </div>
            <div className="admin-repairs-drawer__body">
              {detailLoading ? <p className="admin-page__muted">Đang tải…</p> : null}
              {detailErr ? (
                <p className="admin-msg admin-msg--err" role="alert">
                  {detailErr}
                </p>
              ) : null}
              {!detailLoading && detail ? (
                <>
                  <div className="admin-repairs-drawer__section">
                    <h3>Khách hàng</h3>
                    <dl className="admin-repairs-drawer__dl">
                      <dt>Họ tên</dt>
                      <dd>{detail.user?.full_name || "—"}</dd>
                      <dt>Email</dt>
                      <dd>{detail.user?.email || "—"}</dd>
                      <dt>Số điện thoại</dt>
                      <dd>{detail.user?.phone || "—"}</dd>
                    </dl>
                  </div>
                  <div className="admin-repairs-drawer__section">
                    <h3>Sản phẩm &amp; đơn hàng</h3>
                    <dl className="admin-repairs-drawer__dl">
                      <dt>Sản phẩm</dt>
                      <dd>{detail.warranty?.order_item?.product?.product_name || "—"}</dd>
                      <dt>SKU</dt>
                      <dd>{detail.warranty?.order_item?.product?.sku || "—"}</dd>
                      <dt>Mã đơn</dt>
                      <dd>{detail.warranty?.order_item?.order?.order_id ?? "—"}</dd>
                    </dl>
                  </div>
                  <div className="admin-repairs-drawer__section">
                    <h3>Bảo hành</h3>
                    <dl className="admin-repairs-drawer__dl">
                      <dt>Mã phiếu</dt>
                      <dd>{detail.warranty_id}</dd>
                      <dt>Từ — đến</dt>
                      <dd>
                        {detail.warranty?.start_date?.slice?.(0, 10) || "—"} — {detail.warranty?.end_date?.slice?.(0, 10) || "—"}
                      </dd>
                      <dt>Trạng thái phiếu</dt>
                      <dd>{detail.warranty?.status || "—"}</dd>
                    </dl>
                  </div>
                  <div className="admin-repairs-drawer__section">
                    <h3>Mô tả lỗi (khách)</h3>
                    <p style={{ margin: 0, fontSize: "0.88rem", lineHeight: 1.5 }}>{detail.issue_description}</p>
                  </div>
                  <div className="admin-repairs-drawer__section">
                    <h3>Ảnh đính kèm</h3>
                    {parseAttachments(detail.attachment_urls).length === 0 ? (
                      <p className="admin-repairs-drawer__hint">Không có ảnh.</p>
                    ) : (
                      <div className="admin-repairs-drawer__imgs">
                        {parseAttachments(detail.attachment_urls).map((url) => (
                          <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                            <img src={url} alt="" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="admin-repairs-drawer__section">
                    <h3>Trạng thái hiện tại</h3>
                    <p style={{ margin: 0 }}>
                      <span className={repairBadgeClass(detail.repair_status)}>{repairStatusLabel(detail.repair_status)}</span>
                      {detail.completed_at ? (
                        <span style={{ marginLeft: "0.5rem", fontSize: "0.8rem", color: "#666" }}>
                          Hoàn tất lúc: {new Date(detail.completed_at).toLocaleString("vi-VN")}
                        </span>
                      ) : null}
                    </p>
                  </div>

                  <form className="admin-repairs-drawer__form" onSubmit={submitForm}>
                    <div className="admin-repairs-drawer__section">
                      <h3>Cập nhật xử lý</h3>
                      <label>
                        Trạng thái
                        <select
                          value={form.repair_status}
                          onChange={(e) => setForm((f) => ({ ...f, repair_status: e.target.value }))}
                        >
                          {REPAIR_STATUS_ORDER.map((s) => (
                            <option key={s} value={s}>
                              {REPAIR_STATUS_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Ghi chú nội bộ (admin)
                        <textarea
                          value={form.admin_notes}
                          onChange={(e) => setForm((f) => ({ ...f, admin_notes: e.target.value }))}
                          placeholder="Ghi chú không hiển thị cho khách…"
                        />
                      </label>
                      <label>
                        Kết quả / phản hồi cho khách
                        <textarea
                          value={form.resolution_notes}
                          onChange={(e) => setForm((f) => ({ ...f, resolution_notes: e.target.value }))}
                          placeholder="Mô tả kết quả sửa chữa, hướng dẫn nhận máy…"
                        />
                      </label>
                      <label>
                        Ngày dự kiến hoàn tất
                        <input
                          type="date"
                          value={form.expected_completion_date}
                          onChange={(e) => setForm((f) => ({ ...f, expected_completion_date: e.target.value }))}
                        />
                      </label>
                    </div>
                    <div className="admin-repairs-drawer__form-actions">
                      <button type="submit" className="admin-repairs-drawer__btn admin-repairs-drawer__btn--dark" disabled={saving}>
                        {saving ? "Đang lưu…" : "Lưu thay đổi"}
                      </button>
                      <button
                        type="button"
                        className="admin-repairs-drawer__btn admin-repairs-drawer__btn--success"
                        disabled={saving}
                        onClick={() => saveDetail({ repair_status: "completed" })}
                      >
                        Đánh dấu hoàn tất
                      </button>
                      <button
                        type="button"
                        className="admin-repairs-drawer__btn admin-repairs-drawer__btn--danger"
                        disabled={saving}
                        onClick={() => {
                          if (window.confirm("Từ chối yêu cầu này?")) saveDetail({ repair_status: "rejected" });
                        }}
                      >
                        Từ chối yêu cầu
                      </button>
                    </div>
                    <p className="admin-repairs-drawer__hint">
                      «Đánh dấu hoàn tất» đặt trạng thái <strong>completed</strong> và ghi nhận thời điểm hoàn tất (nếu chưa có).
                    </p>
                  </form>
                </>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
