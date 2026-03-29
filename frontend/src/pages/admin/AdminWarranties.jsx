import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPatch } from "../../api/client.js";
import { repairStatusLabel } from "../../utils/repairStatusConfig.js";
import "./AdminPages.css";

/** @typedef {import("../../types/adminWarranty").AdminWarrantyItem} AdminWarrantyItem */

/** 3 dòng minh họa khi chưa có dữ liệu — tương tự seed: demo-buyer + 2 khách BH mẫu */
const EXAMPLE_ROWS = [
  {
    warranty_code: "BH-101",
    order_code: "DH-000042",
    user_name: "Phạm Hoài Nam",
    product_name: "Máy siết bulong pin 18V",
    product_sku: "SKU-M18-FUEL",
    end_date: "2027-06-30",
    days_remaining: 210,
    repair_request_count: 1,
    status: "active"
  },
  {
    warranty_code: "BH-102",
    order_code: "DH-000043",
    user_name: "Trần Thị Nga",
    product_name: "Máy khoan bê tông 26mm",
    product_sku: "SKU-GBH-26",
    end_date: "2028-12-31",
    days_remaining: 400,
    repair_request_count: 0,
    status: "active"
  },
  {
    warranty_code: "BH-103",
    order_code: "DH-000044",
    user_name: "Lê Văn Minh",
    product_name: "Máy mài góc 125mm",
    product_sku: "SKU-AG-125",
    end_date: "2024-06-01",
    days_remaining: -120,
    repair_request_count: 0,
    status: "expired"
  }
];

function formatDateShort(iso) {
  if (!iso) return "—";
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}`;
}

function daysRemainingLabel(dr) {
  if (dr == null || Number.isNaN(Number(dr))) return "—";
  const n = Number(dr);
  if (n < 0) return `Quá hạn ${-n} ngày`;
  if (n === 0) return "Hết hạn hôm nay";
  return `Còn ${n} ngày`;
}

/** Nhãn đọc nhanh — khớp logic backend (active nhưng quá end_date) */
function warrantyStatusLabelVi(status, daysRemaining) {
  if (status === "active" && daysRemaining != null && Number(daysRemaining) < 0) {
    return "Hết hạn (theo ngày)";
  }
  const m = {
    active: "Đang hiệu lực",
    expired: "Hết hạn",
    claimed: "Đã kích hoạt / yêu cầu",
    void: "Vô hiệu",
    pending: "Chờ kích hoạt"
  };
  return m[status] || status;
}

export default function AdminWarranties() {
  const [rows, setRows] = useState(
    /** @type {AdminWarrantyItem[]} */
    ([])
  );
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  /** @type {Record<string, string>} */
  const [draftAdminNote, setDraftAdminNote] = useState(() => ({}));
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(async () => {
    const data = await apiGet("/admin/warranties");
    const list = Array.isArray(data) ? data : [];
    setRows(list);
    const next = {};
    for (const w of list) {
      next[String(w.warranty_id)] = w.admin_note ?? "";
    }
    setDraftAdminNote(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        await load();
      } catch (e) {
        if (!cancelled) setErr(e.message || "Không tải được danh sách bảo hành.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function setStatus(id, status) {
    setErr("");
    try {
      await apiPatch(`/admin/warranties/${id}`, { status });
      await load();
    } catch (e) {
      setErr(e.message || "Lỗi");
    }
  }

  async function saveAdminNote(warrantyId) {
    const id = String(warrantyId);
    const text = draftAdminNote[id];
    if (text === undefined) return;
    setErr("");
    setSavingId(warrantyId);
    try {
      await apiPatch(`/admin/warranties/${warrantyId}`, {
        admin_note: String(text).trim() || null
      });
      await load();
    } catch (e) {
      setErr(e.message || "Không lưu được ghi chú.");
    } finally {
      setSavingId(null);
    }
  }

  const empty = !loading && rows.length === 0;

  return (
    <div className="admin-page">
      <h1>Bảo hành</h1>
      <p className="admin-page__muted">
        Danh sách theo kiểu <code className="admin-page__code-inline">AdminWarrantyItem</code> (API phẳng: mã phiếu, mã đơn,
        khách, sản phẩm, hạn, sửa chữa, <code className="admin-page__code-inline">admin_note</code>, …). Khách xem tại «Xem bảo
        hành».
      </p>

      {err ? (
        <p className="admin-msg admin-msg--err" role="alert">
          {err}
        </p>
      ) : null}

      <div className="admin-page__panel">
        {loading ? (
          <p className="admin-page__muted" style={{ margin: 0 }}>
            Đang tải…
          </p>
        ) : (
          <>
            <div className="admin-table-wrap admin-warranties__table-wrap">
              <table className="admin-table admin-table--compact">
                <thead>
                  <tr>
                    <th>Mã phiếu</th>
                    <th>Mã đơn</th>
                    <th>Khách</th>
                    <th>Sản phẩm</th>
                    <th>Đến ngày</th>
                    <th>Còn / quá hạn</th>
                    <th>Trạng thái</th>
                    <th>Sửa chữa</th>
                    <th>Đổi TT</th>
                    <th>Ghi chú admin</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((w) => {
                    const id = String(w.warranty_id);
                    const draft = draftAdminNote[id] ?? "";
                    return (
                      <tr key={id}>
                        <td>{w.warranty_code ?? `BH-${w.warranty_id}`}</td>
                        <td>{w.order_code ?? "—"}</td>
                        <td>
                          <div>{w.user_name || "—"}</div>
                          {w.user_phone ? (
                            <span className="admin-page__muted" style={{ fontSize: "0.82rem" }}>
                              {w.user_phone}
                            </span>
                          ) : null}
                        </td>
                        <td>
                          <div>{w.product_name}</div>
                          {w.product_sku ? (
                            <span className="admin-page__muted" style={{ fontSize: "0.82rem" }}>
                              {w.product_sku}
                            </span>
                          ) : null}
                        </td>
                        <td>{formatDateShort(w.end_date)}</td>
                        <td>{daysRemainingLabel(w.days_remaining)}</td>
                        <td>
                          <span title={w.status}>{warrantyStatusLabelVi(w.status, w.days_remaining)}</span>
                          {w.is_expired ? (
                            <span className="admin-warranties__badge-exp" title="Hết hiệu lực">
                              Hết hạn
                            </span>
                          ) : null}
                        </td>
                        <td>
                          {w.repair_request_count ? (
                            <>
                              <strong>{w.repair_request_count}</strong>
                              {w.latest_repair_status ? (
                                <div className="admin-page__muted" style={{ fontSize: "0.78rem" }}>
                                  {repairStatusLabel(w.latest_repair_status)}
                                </div>
                              ) : null}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          <select value={w.status} onChange={(e) => setStatus(w.warranty_id, e.target.value)}>
                            <option value="active">Đang hiệu lực</option>
                            <option value="pending">Chờ kích hoạt</option>
                            <option value="claimed">Đã kích hoạt / yêu cầu</option>
                            <option value="expired">Hết hạn</option>
                            <option value="void">Vô hiệu</option>
                          </select>
                        </td>
                        <td className="admin-warranties__notes-cell">
                          <textarea
                            className="admin-warranties__textarea"
                            rows={3}
                            value={draft}
                            onChange={(e) =>
                              setDraftAdminNote((prev) => ({
                                ...prev,
                                [id]: e.target.value
                              }))
                            }
                            placeholder="Nội bộ (admin_note)…"
                          />
                          <button
                            type="button"
                            className="admin-warranties__save-note"
                            disabled={savingId === w.warranty_id}
                            onClick={() => saveAdminNote(w.warranty_id)}
                          >
                            {savingId === w.warranty_id ? "Đang lưu…" : "Lưu"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {empty ? (
              <div className="admin-page__example" aria-label="Ví dụ minh họa">
                <p className="admin-page__example-title">Ví dụ 3 khách (minh họa)</p>
                <p className="admin-page__example-note">
                  Khi có phiếu thật (hoặc sau <code className="admin-page__code-inline">npx prisma db seed</code>), bảng trên
                  hiển thị dữ liệu thực; dưới đây là cách đọc cột với 2–3 người khác nhau.
                </p>
                <div className="admin-table-wrap">
                  <table className="admin-table admin-table--example admin-table--compact">
                    <thead>
                      <tr>
                        <th>Mã phiếu</th>
                        <th>Mã đơn</th>
                        <th>Khách</th>
                        <th>Sản phẩm</th>
                        <th>Đến ngày</th>
                        <th>Còn / quá hạn</th>
                        <th>TT</th>
                        <th>Sửa chữa</th>
                        <th>Đổi TT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {EXAMPLE_ROWS.map((row) => (
                        <tr key={row.warranty_code}>
                          <td>{row.warranty_code}</td>
                          <td>{row.order_code}</td>
                          <td>{row.user_name}</td>
                          <td>
                            {row.product_name}
                            <div className="admin-page__muted" style={{ fontSize: "0.82rem" }}>
                              {row.product_sku}
                            </div>
                          </td>
                          <td>{formatDateShort(row.end_date)}</td>
                          <td>{daysRemainingLabel(row.days_remaining)}</td>
                          <td>{warrantyStatusLabelVi(row.status, row.days_remaining)}</td>
                          <td>{row.repair_request_count || "—"}</td>
                          <td>
                            <span className="admin-page__muted">Chọn trạng thái</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="admin-page__example-note" style={{ marginBottom: 0, marginTop: "0.75rem" }}>
                  Các trường bổ sung cho admin: <code className="admin-page__code-inline">repair_request_count</code>,{" "}
                  <code className="admin-page__code-inline">latest_repair_status</code>,{" "}
                  <code className="admin-page__code-inline">admin_note</code>, <code className="admin-page__code-inline">is_expired</code>,{" "}
                  <code className="admin-page__code-inline">days_remaining</code>; <code className="admin-page__code-inline">delivered_at</code>{" "}
                  dùng khi backend có ngày giao trên đơn.
                </p>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
