import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPatch } from "../../api/client.js";
import "./AdminPages.css";

function clip(s, n = 90) {
  if (!s) return "—";
  const t = String(s).trim();
  return t.length <= n ? t : `${t.slice(0, n)}…`;
}

function ShopNoteEditor({ refundId, initial, onSaved, setErr, setMsg }) {
  const [val, setVal] = useState(initial || "");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setVal(initial || "");
  }, [refundId, initial]);

  async function save() {
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      await apiPatch(`/admin/refund-requests/${refundId}`, { admin_note: val });
      setMsg("Đã lưu phản hồi cửa hàng.");
      await onSaved();
    } catch (e) {
      setErr(e.message || "Không lưu được.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ minWidth: 200, maxWidth: 280 }}>
      <textarea
        className="admin-refund-note-ta"
        rows={3}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="Phản hồi cho khách (hiển thị ở trang Hoàn tiền & đơn hàng)…"
        aria-label={`Phản hồi cửa hàng #${refundId}`}
      />
      <button
        type="button"
        className="admin-btn"
        style={{ marginTop: 6, fontSize: "0.75rem", padding: "0.3rem 0.5rem" }}
        disabled={saving}
        onClick={save}
      >
        {saving ? "Đang lưu…" : "Lưu phản hồi"}
      </button>
    </div>
  );
}

function money(n) {
  return Number(n || 0).toLocaleString("vi-VN");
}

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

/** Đồng bộ với backend ALLOWED_REFUND_STATUSES */
const REFUND_STATUS_OPTIONS = [
  { value: "pending", label: "Chờ xử lý" },
  { value: "approved", label: "Đã duyệt" },
  { value: "rejected", label: "Từ chối" },
  { value: "completed", label: "Hoàn tất (đã xử lý)" }
];

const FILTER_OPTIONS = [{ value: "all", label: "Tất cả" }, ...REFUND_STATUS_OPTIONS];

function statusLabel(value) {
  const o = REFUND_STATUS_OPTIONS.find((x) => x.value === value);
  return o ? o.label : value || "—";
}

export default function AdminRefunds() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async () => {
    const data = await apiGet("/admin/refund-requests");
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
    return rows.filter((r) => r.refund_status === statusFilter);
  }, [rows, statusFilter]);

  async function setStatus(id, refund_status, confirmMsg) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setErr("");
    setMsg("");
    try {
      await apiPatch(`/admin/refund-requests/${id}`, { refund_status });
      const label = statusLabel(refund_status);
      setMsg(`Đã cập nhật trạng thái: ${label}.`);
      await load();
    } catch (e) {
      setErr(e.message || "Không cập nhật được.");
    }
  }

  async function onSelectChange(id, next) {
    await setStatus(id, next, null);
  }

  return (
    <div className="admin-page">
      <h1>Hoàn tiền</h1>
      <p className="admin-page__muted">
        Xem yêu cầu hoàn tiền từ khách, <strong>ghi chú / phản hồi</strong> (khách xem trên trang Hoàn tiền),{" "}
        <strong>duyệt</strong> hoặc <strong>từ chối</strong>, và cập nhật trạng thái đến khi hoàn tất.
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
          Hiển thị {filteredRows.length} / {rows.length} yêu cầu
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
                <th>Ngày yêu cầu</th>
                <th>Mã đơn</th>
                <th>Khách</th>
                <th>Email</th>
                <th>Số tiền hoàn</th>
                <th>Lý do</th>
                <th>Ghi chú khách</th>
                <th>Phản hồi shop</th>
                <th>Trạng thái</th>
                <th>Duyệt / Từ chối / Cập nhật</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: "center", color: "#666" }}>
                    {rows.length === 0 ? "Chưa có yêu cầu hoàn tiền." : "Không có bản ghi khớp bộ lọc."}
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  const pending = r.refund_status === "pending";
                  const approved = r.refund_status === "approved";
                  return (
                    <tr key={r.refund_request_id}>
                      <td>{r.refund_request_id}</td>
                      <td style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>{fmtDate(r.request_date)}</td>
                      <td>
                        <strong>#{r.order_id}</strong>
                        {r.order?.order_status ? (
                          <span className="admin-page__muted" style={{ display: "block", fontSize: "0.72rem" }}>
                            Đơn: {r.order.order_status}
                          </span>
                        ) : null}
                      </td>
                      <td>{r.user?.full_name || "—"}</td>
                      <td style={{ wordBreak: "break-all", fontSize: "0.8rem" }}>{r.user?.email || "—"}</td>
                      <td>{money(r.refund_amount)}đ</td>
                      <td style={{ maxWidth: 200, fontSize: "0.8rem" }} title={r.reason}>
                        {r.reason && r.reason.length > 120 ? `${r.reason.slice(0, 120)}…` : r.reason || "—"}
                      </td>
                      <td style={{ maxWidth: 180, fontSize: "0.8rem" }} title={r.buyer_note || ""}>
                        {clip(r.buyer_note, 100)}
                      </td>
                      <td style={{ verticalAlign: "top" }}>
                        <ShopNoteEditor
                          refundId={r.refund_request_id}
                          initial={r.admin_note}
                          onSaved={load}
                          setErr={setErr}
                          setMsg={setMsg}
                        />
                      </td>
                      <td>
                        <span
                          className={`admin-badge ${
                            r.refund_status === "completed"
                              ? "admin-badge--ok"
                              : r.refund_status === "rejected"
                                ? "admin-badge--off"
                                : ""
                          }`}
                        >
                          {statusLabel(r.refund_status)}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", minWidth: "11rem" }}>
                          <select
                            className="admin-select--order-status"
                            value={r.refund_status}
                            onChange={(e) => onSelectChange(r.refund_request_id, e.target.value)}
                            aria-label={`Trạng thái hoàn tiền #${r.refund_request_id}`}
                          >
                            {REFUND_STATUS_OPTIONS.map((o) => (
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
                                      r.refund_request_id,
                                      "approved",
                                      `Duyệt hoàn tiền #${r.refund_request_id} (${money(r.refund_amount)}đ)?`
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
                                    setStatus(
                                      r.refund_request_id,
                                      "rejected",
                                      `Từ chối hoàn tiền #${r.refund_request_id}?`
                                    )
                                  }
                                >
                                  Từ chối
                                </button>
                              </>
                            ) : null}
                            {approved ? (
                              <button
                                type="button"
                                className="admin-btn"
                                style={{ padding: "0.25rem 0.45rem", fontSize: "0.75rem" }}
                                onClick={() =>
                                  setStatus(
                                    r.refund_request_id,
                                    "completed",
                                    "Đánh dấu đã hoàn tất xử lý hoàn tiền (chuyển khoản / hoàn tiền xong)?"
                                  )
                                }
                              >
                                Hoàn tất
                              </button>
                            ) : null}
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
