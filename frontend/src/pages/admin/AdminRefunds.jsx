import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPatch } from "../../api/client.js";
import { CoreBadge, CoreButton, CoreCard, CoreDialog, CoreSpinner, CoreTable } from "../../components/ui/index.js";
import useAdminToastNotices from "../../hooks/useAdminToastNotices.js";

function clip(s, n = 90) {
  if (!s) return "—";
  const t = String(s).trim();
  return t.length <= n ? t : `${t.slice(0, n)}…`;
}

function money(n) {
  return Number(n || 0).toLocaleString("vi-VN");
}

/** Chuỗi nhập: 1500000, 1.500.000, 1500.5 (thập phân), 1.500.000,5 */
function parseMoneyInput(val) {
  const s = String(val).trim().replace(/\s/g, "");
  if (!s) return NaN;
  if (s.includes(",")) {
    return Number(s.replace(/\./g, "").replace(",", "."));
  }
  if (/^\d+\.\d{1,2}$/.test(s)) {
    return Number(s);
  }
  return Number(s.replace(/\./g, ""));
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
  useAdminToastNotices({ err, msg, setErr, setMsg });
  const [statusFilter, setStatusFilter] = useState("all");
  const [amountDialog, setAmountDialog] = useState(null);
  const [shopNoteDialog, setShopNoteDialog] = useState(null);
  const [dialogSaving, setDialogSaving] = useState(false);

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
      setErr(e.message || "Không cập nhật được dữ liệu.");
    }
  }

  async function onSelectChange(id, next) {
    await setStatus(id, next, null);
  }

  async function saveAmountDialog() {
    if (!amountDialog) return;
    const n = parseMoneyInput(amountDialog.val);
    if (Number.isNaN(n) || n < 0) {
      setErr("Nhập số tiền hợp lệ (≥ 0).");
      return;
    }
    const cap = amountDialog.orderTotal != null ? Number(amountDialog.orderTotal) : null;
    if (cap != null && n > cap) {
      setErr(`Không vượt tổng đơn (${money(cap)}đ).`);
      return;
    }
    setDialogSaving(true);
    setErr("");
    setMsg("");
    try {
      await apiPatch(`/admin/refund-requests/${amountDialog.id}`, { refund_amount: n });
      setMsg("Đã cập nhật số tiền hoàn.");
      setAmountDialog(null);
      await load();
    } catch (e) {
      setErr(e.message || "Không lưu được dữ liệu.");
    } finally {
      setDialogSaving(false);
    }
  }

  async function saveShopNoteDialog() {
    if (!shopNoteDialog) return;
    setDialogSaving(true);
    setErr("");
    setMsg("");
    try {
      await apiPatch(`/admin/refund-requests/${shopNoteDialog.id}`, { admin_note: shopNoteDialog.val });
      setMsg("Đã lưu phản hồi cửa hàng.");
      setShopNoteDialog(null);
      await load();
    } catch (e) {
      setErr(e.message || "Không lưu được dữ liệu.");
    } finally {
      setDialogSaving(false);
    }
  }

  return (
    <div className="admin-page">
      <h1 className="admin-section-title">Hoàn tiền</h1>
      <p className="admin-lead">
        Xem yêu cầu hoàn tiền từ khách, <strong>ghi chú / phản hồi</strong> (khách xem trên trang Hoàn tiền),{" "}
        <strong>duyệt</strong> hoặc <strong>từ chối</strong>, và cập nhật trạng thái đến khi hoàn tất.
      </p>

      <CoreCard>
        <div className="flex flex-wrap items-center gap-3">
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
            Hiển thị {filteredRows.length} / {rows.length} yêu cầu
          </span>
        </div>
      </CoreCard>

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-10">
          <CoreSpinner />
          <span className="text-[#666666] font-semibold">Đang tải dữ liệu…</span>
        </div>
      ) : (
        <CoreCard>
          <CoreTable
            value={filteredRows}
            dataKey="refund_request_id"
            rows={10}
            emptyMessage={rows.length === 0 ? "Chưa có yêu cầu hoàn tiền." : "Không có bản ghi khớp bộ lọc."}
            actionConfig={{
              copyFields: [
                { label: "ID hoàn tiền", field: "refund_request_id" },
                { label: "Mã đơn", field: "order_id" },
                { label: "Email khách", value: (row) => row.user?.email || "" },
              ],
              excel: { fileName: "admin-refunds.xlsx" },
            }}
            columns={[
              { key: "id", header: "ID", field: "refund_request_id" },
              { key: "date", header: "Ngày yêu cầu", body: (r) => fmtDate(r.request_date) },
              {
                key: "order",
                header: "Mã đơn",
                body: (r) => (
                  <div>
                    <strong>#{r.order_id}</strong>
                    {r.order?.order_status ? <div className="text-xs text-[#666666]">Đơn: {r.order.order_status}</div> : null}
                  </div>
                ),
              },
              { key: "user", header: "Khách", body: (r) => r.user?.full_name || "—" },
              { key: "email", header: "Email", body: (r) => <span className="break-all text-sm">{r.user?.email || "—"}</span> },
              {
                key: "amount",
                header: "Số tiền hoàn (admin)",
                body: (r) => (
                  <div className="min-w-[180px] space-y-2">
                    <div className="text-sm font-semibold">{money(r.refund_amount)}đ</div>
                    {r.order?.total_amount != null ? (
                      <div className="text-[0.68rem] text-[#666666]">Tối đa đơn: {money(r.order.total_amount)}đ</div>
                    ) : null}
                    <CoreButton
                      type="button"
                      tone="ghost"
                      label="Sửa số tiền"
                      className="!px-2.5 !py-1 !text-xs"
                      onClick={() =>
                        setAmountDialog({
                          id: r.refund_request_id,
                          val: String(r.refund_amount ?? ""),
                          orderTotal: r.order?.total_amount ?? null,
                        })
                      }
                    />
                  </div>
                ),
              },
              { key: "reason", header: "Lý do", body: (r) => <span title={r.reason || ""}>{clip(r.reason, 120)}</span> },
              { key: "buyer", header: "Ghi chú khách", body: (r) => <span title={r.buyer_note || ""}>{clip(r.buyer_note, 100)}</span> },
              {
                key: "shop",
                header: "Phản hồi shop",
                body: (r) => (
                  <div className="min-w-[220px] space-y-2">
                    <div className="text-sm text-[#111111]" title={r.admin_note || ""}>
                      {clip(r.admin_note, 80)}
                    </div>
                    <CoreButton
                      type="button"
                      tone="ghost"
                      label="Sửa phản hồi"
                      className="!px-2.5 !py-1 !text-xs"
                      onClick={() =>
                        setShopNoteDialog({
                          id: r.refund_request_id,
                          val: r.admin_note || "",
                        })
                      }
                    />
                  </div>
                ),
              },
              {
                key: "status",
                header: "Trạng thái",
                body: (r) => {
                  const st = r.refund_status;
                  const tone = st === "completed" ? "success" : st === "rejected" ? "danger" : st === "approved" ? "info" : "warn";
                  return <CoreBadge value={statusLabel(st)} tone={tone} />;
                },
              },
              {
                key: "actions",
                header: "Duyệt / Từ chối / Cập nhật",
                body: (r) => {
                  const pending = r.refund_status === "pending";
                  const approved = r.refund_status === "approved";
                  return (
                    <div className="min-w-[12rem] space-y-2">
                      <select
                        className="admin-form-control w-full"
                        value={r.refund_status}
                        onChange={(e) => onSelectChange(r.refund_request_id, e.target.value)}
                      >
                        {REFUND_STATUS_OPTIONS.map((o) => (
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
                              onClick={() =>
                                setStatus(
                                  r.refund_request_id,
                                  "approved",
                                  `Duyệt hoàn tiền #${r.refund_request_id} (${money(r.refund_amount)}đ)?`
                                )
                              }
                            />
                            <CoreButton
                              type="button"
                              tone="danger"
                              label="Từ chối"
                              className="!px-2.5 !py-1 !text-xs"
                              onClick={() =>
                                setStatus(r.refund_request_id, "rejected", `Từ chối hoàn tiền #${r.refund_request_id}?`)
                              }
                            />
                          </>
                        ) : null}
                        {approved ? (
                          <CoreButton
                            type="button"
                            tone="secondary"
                            label="Hoàn tất"
                            className="!px-2.5 !py-1 !text-xs"
                            onClick={() =>
                              setStatus(
                                r.refund_request_id,
                                "completed",
                                "Đánh dấu đã hoàn tất xử lý hoàn tiền (chuyển khoản / hoàn tiền xong)?"
                              )
                            }
                          />
                        ) : null}
                      </div>
                    </div>
                  );
                },
              },
            ]}
          />
        </CoreCard>
      )}

      <CoreDialog
        header={amountDialog ? `Cập nhật số tiền hoàn #${amountDialog.id}` : "Cập nhật số tiền hoàn"}
        visible={!!amountDialog}
        modal
        onHide={() => setAmountDialog(null)}
      >
        {amountDialog ? (
          <div className="space-y-3">
            <label className="admin-form-label">
              Số tiền hoàn (đ)
              <input
                className="admin-form-control mt-1"
                value={amountDialog.val}
                onChange={(e) => setAmountDialog((d) => ({ ...d, val: e.target.value }))}
              />
            </label>
            {amountDialog.orderTotal != null ? (
              <p className="text-xs text-[#666666] m-0">Tối đa theo đơn: {money(amountDialog.orderTotal)}đ</p>
            ) : null}
            <div className="flex gap-2">
              <CoreButton type="button" disabled={dialogSaving} label={dialogSaving ? "Đang lưu…" : "Lưu"} onClick={saveAmountDialog} />
              <CoreButton type="button" tone="ghost" disabled={dialogSaving} label="Hủy" onClick={() => setAmountDialog(null)} />
            </div>
          </div>
        ) : null}
      </CoreDialog>

      <CoreDialog
        header={shopNoteDialog ? `Phản hồi shop #${shopNoteDialog.id}` : "Phản hồi shop"}
        visible={!!shopNoteDialog}
        modal
        onHide={() => setShopNoteDialog(null)}
      >
        {shopNoteDialog ? (
          <div className="space-y-3">
            <label className="admin-form-label">
              Nội dung phản hồi
              <textarea
                rows={5}
                className="admin-form-control mt-1"
                value={shopNoteDialog.val}
                onChange={(e) => setShopNoteDialog((d) => ({ ...d, val: e.target.value }))}
                placeholder="Phản hồi cho khách (hiển thị ở trang Hoàn tiền và đơn hàng)…"
              />
            </label>
            <div className="flex gap-2">
              <CoreButton type="button" disabled={dialogSaving} label={dialogSaving ? "Đang lưu…" : "Lưu phản hồi"} onClick={saveShopNoteDialog} />
              <CoreButton type="button" tone="ghost" disabled={dialogSaving} label="Hủy" onClick={() => setShopNoteDialog(null)} />
            </div>
          </div>
        ) : null}
      </CoreDialog>
    </div>
  );
}
