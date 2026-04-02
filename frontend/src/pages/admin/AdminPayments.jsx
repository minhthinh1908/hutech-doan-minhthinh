import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPatch } from "../../api/client.js";
import { paymentStatusAdminLabel } from "../../utils/paymentStatusLabels.js";
import { CoreBadge, CoreButton, CoreCard, CoreDialog, CoreFilterActions, CoreFilterButtons, CoreMessage, CoreSpinner, CoreTable } from "../../components/ui/index.js";
import useAdminToastNotices from "../../hooks/useAdminToastNotices.js";

function money(n) {
  if (n == null || n === "") return "—";
  return Number(n).toLocaleString("vi-VN");
}

function fmtDt(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return String(iso);
  }
}

const PAY_METHOD_LABELS = {
  cod: "COD (thanh toán khi nhận)",
  bank_transfer: "Chuyển khoản",
  payment_gateway: "Cổng thanh toán trực tuyến"
};

function payMethodLabel(code) {
  if (!code) return "—";
  return PAY_METHOD_LABELS[code] || code;
}

/** Trạng thái dòng payment (gateway / đối soát) */
function payRowStatusLabel(s) {
  const k = String(s || "").toLowerCase();
  const tech = {
    timeout: "Timeout cổng",
    callback_failed: "Callback lỗi",
    awaiting_confirmation: "awaiting_confirmation (legacy)"
  };
  if (tech[k]) return tech[k];
  if (k === "success") return paymentStatusAdminLabel("paid");
  return paymentStatusAdminLabel(s);
}

/** Trạng thái thanh toán cấp đơn hàng */
function orderPayLabel(s) {
  const k = String(s || "").toLowerCase();
  if (k === "pending_confirmation") return "Chờ xác nhận (legacy)";
  return paymentStatusAdminLabel(s);
}

function toDatetimeLocalValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STATUS_FILTER = [
  { value: "all", label: "Mọi trạng thái GD" },
  { value: "pending", label: "Đang chờ" },
  { value: "processing", label: "Đang xử lý" },
  { value: "paid", label: "paid — Thành công" },
  { value: "success", label: "success (legacy)" },
  { value: "failed", label: "Thất bại" },
  { value: "refunded", label: "Hoàn tiền" },
  { value: "timeout", label: "Timeout cổng" },
  { value: "callback_failed", label: "Callback lỗi" },
  { value: "cancelled", label: "Đã hủy (GD)" }
];
const QUICK_FILTER_OPTIONS = [
  { value: "failed", label: "GD / đơn thất bại", activeLabel: "✓ Thất bại" },
  { value: "refunded", label: "Đơn hoàn tiền", activeLabel: "✓ Hoàn tiền" },
  { value: "abnormal", label: "GD bất thường / lỗi", activeLabel: "✓ Bất thường" }
];

function displayAmount(p) {
  if (p.paid_amount != null && p.paid_amount !== "") return p.paid_amount;
  return p.order?.total_amount ?? null;
}

export default function AdminPayments() {
  const [rows, setRows] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortField, setSortField] = useState("payment_id");
  const [sortOrder, setSortOrder] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  useAdminToastNotices({ err, msg, setErr, setMsg });
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  /** Xem nhanh: thất bại (GD hoặc đơn) / đơn hoàn tiền */
  const [quick, setQuick] = useState("");
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);

  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState("");

  const [form, setForm] = useState({
    payment_status: "",
    transaction_code: "",
    paid_amount: "",
    paid_at: ""
  });

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    const params = {};
    if (quick) {
      params.quick = quick;
    } else if (statusFilter && statusFilter !== "all") {
      params.payment_status = statusFilter;
    }
    if (qDebounced) params.q = qDebounced;
    params.page = Math.floor(first / rowsPerPage) + 1;
    params.limit = rowsPerPage;
    params.sortField = sortField;
    params.sortOrder = sortOrder;
    const data = await apiGet("/admin/payments", params);
    if (Array.isArray(data)) {
      setRows(data);
      setTotalRecords(data.length);
      return;
    }
    setRows(Array.isArray(data?.items) ? data.items : []);
    setTotalRecords(Number(data?.total) || 0);
  }, [statusFilter, qDebounced, quick, first, rowsPerPage, sortField, sortOrder]);

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

  function openEdit(p) {
    setEdit(p);
    setForm({
      payment_status: p.payment_status || "pending",
      transaction_code: p.transaction_code || "",
      paid_amount: p.paid_amount != null ? String(p.paid_amount) : "",
      paid_at: toDatetimeLocalValue(p.paid_at)
    });
    setErr("");
    setMsg("");
  }

  function closeEdit() {
    setEdit(null);
    setSaving(false);
  }

  async function saveEdit() {
    if (!edit) return;
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      const body = {
        payment_status: form.payment_status,
        transaction_code: form.transaction_code.trim() || null,
        paid_amount: form.paid_amount.trim() === "" ? null : Number(form.paid_amount.replace(/\s/g, "").replace(",", ".")),
        paid_at: form.paid_at ? new Date(form.paid_at).toISOString() : null
      };
      if (body.paid_amount != null && (!Number.isFinite(body.paid_amount) || body.paid_amount < 0)) {
        setErr("Số tiền đã thu không hợp lệ.");
        setSaving(false);
        return;
      }
      await apiPatch(`/admin/payments/${edit.payment_id}`, body, { auth: true });
      setMsg("Đã cập nhật dữ liệu đối soát.");
      await load();
      closeEdit();
    } catch (e) {
      setErr(e.message || "Không lưu được dữ liệu.");
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(paymentId) {
    setDetailId(paymentId);
    setDetail(null);
    setDetailErr("");
    setDetailLoading(true);
    try {
      const data = await apiGet(`/admin/payments/${paymentId}`);
      setDetail(data);
    } catch (e) {
      setDetailErr(e.message || "Không tải được chi tiết.");
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setDetailId(null);
    setDetail(null);
    setDetailErr("");
  }

  function setQuickFilter(next) {
    setQuick(next);
    if (next) setStatusFilter("all");
  }

  return (
    <div className="admin-page">
      <h1 className="admin-section-title">Thanh toán (Payment Gateway)</h1>
      <p className="admin-lead">
        Danh sách giao dịch đã ghi nhận (cổng, chuyển khoản, COD). Tra cứu theo{" "}
        <strong>mã giao dịch</strong>, lọc theo <strong>trạng thái</strong>, xem nhanh{" "}
        <strong>thất bại</strong> hoặc đơn <strong>hoàn tiền</strong>. Admin chỉ xem / đối soát bản ghi — không thực hiện
        giao dịch trực tiếp trên cổng tại đây.
      </p>
      <CoreCard>
        <div className="flex flex-col lg:flex-row gap-4 lg:items-end">
          <label className="flex flex-col gap-2">
            <span className="text-xs font-extrabold uppercase tracking-wide text-[#666666]">Trạng thái giao dịch</span>
            <select
              className="admin-form-control"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                if (e.target.value !== "all") setQuick("");
                setFirst(0);
              }}
              disabled={!!quick}
            >
              {STATUS_FILTER.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-extrabold uppercase tracking-wide text-[#666666]">Xem nhanh</span>
            <CoreFilterButtons
              options={QUICK_FILTER_OPTIONS}
              activeValue={quick}
              buttonClassName="!px-3 !py-1.5 text-sm"
              getLabel={(option, isActive) => (isActive ? option.activeLabel || option.label : option.label)}
              onChange={(next) => {
                setQuickFilter(next === quick ? "" : next);
                setFirst(0);
              }}
            />
          </div>

          <div className="flex-1 flex flex-col gap-2">
            <span className="text-xs font-extrabold uppercase tracking-wide text-[#666666]">Tìm mã giao dịch / mã đơn / mã TT</span>
            <span className="p-input-icon-left">
              <i className="pi pi-search" />
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setFirst(0);
                }}
                placeholder="Ví dụ: VNPAY123 hoặc 42"
                className="admin-form-control w-full"
              />
            </span>
          </div>

          <CoreFilterActions
            mode="clearOnly"
            onClear={() => {
              setQ("");
              setStatusFilter("all");
              setQuick("");
              setFirst(0);
            }}
            buttonClassName="!px-3 !py-1.5 text-sm"
          />
        </div>
      </CoreCard>

      <CoreCard>
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-10">
            <CoreSpinner />
            <span className="text-[#666666] font-semibold">Đang tải dữ liệu…</span>
          </div>
        ) : (
          <CoreTable
            value={rows}
            dataKey="payment_id"
            lazy
            first={first}
            rows={rowsPerPage}
            totalRecords={totalRecords}
            onPage={(e) => {
              setFirst(e.first);
              setRowsPerPage(e.rows);
            }}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={(e) => {
              setSortField(e.sortField || "payment_id");
              setSortOrder(e.sortOrder ?? -1);
              setFirst(0);
            }}
            emptyMessage="Không có bản ghi thanh toán phù hợp."
            columns={[
              { key: "id", header: "Mã TT", field: "payment_id", sortable: true, body: (p) => `#${p.payment_id}` },
              { key: "order", header: "Mã đơn", field: "order_id", sortable: true, body: (p) => `#${p.order?.order_id ?? p.order_id}` },
              {
                key: "user",
                header: "Khách",
                body: (p) => (
                  <div>
                    <div className="font-semibold">{p.order?.user?.full_name || "—"}</div>
                    <div className="text-xs text-[#666666]">{p.order?.user?.email || ""}</div>
                  </div>
                ),
              },
              {
                key: "method",
                header: "Phương thức",
                body: (p) => (
                  <div className="text-sm">
                    <div>{payMethodLabel(p.payment_method)}</div>
                    {p.payment_gateway ? <div className="text-xs text-[#666666]">{p.payment_gateway}</div> : null}
                  </div>
                ),
              },
              { key: "tx", header: "Mã giao dịch", body: (p) => <span className="break-all font-mono text-xs">{p.transaction_code || "—"}</span> },
              { key: "amount", header: "Số tiền", field: "paid_amount", sortable: true, body: (p) => `${money(displayAmount(p))}đ` },
              {
                key: "status",
                header: "Trạng thái GD",
                body: (p) => {
                  const ok = p.payment_status === "success" || p.payment_status === "paid";
                  const bad = p.payment_status === "failed";
                  return <CoreBadge value={payRowStatusLabel(p.payment_status)} tone={ok ? "success" : bad ? "danger" : "neutral"} />;
                },
              },
              { key: "abnormal", header: "Bất thường", body: (p) => (p.is_abnormal ? <CoreBadge value="Có" tone="danger" /> : <span className="text-[#666666]">—</span>) },
              {
                key: "note",
                header: "Ghi chú / lỗi",
                body: (p) =>
                  p.error_code || p.buyer_message ? (
                    <div className="text-xs" title={p.buyer_message || ""}>
                      {p.error_code ? <span className="font-mono text-[#8b2942]">{p.error_code}</span> : null}
                      {p.error_code && p.buyer_message ? <br /> : null}
                      {p.buyer_message ? <span className="text-[#666666]">{p.buyer_message}</span> : null}
                    </div>
                  ) : (
                    "—"
                  ),
              },
              { key: "paidAt", header: "Thời gian TT", field: "paid_at", sortable: true, body: (p) => (p.paid_at ? fmtDt(p.paid_at) : "—") },
              { key: "orderStatus", header: "TT đơn", body: (p) => orderPayLabel(p.order?.payment_status) },
            ]}
            actionConfig={{
              onView: (row) => openDetail(row.payment_id),
              copyFields: [
                { label: "Mã thanh toán", field: "payment_id" },
                { label: "Mã giao dịch", field: "transaction_code" },
                { label: "Trạng thái giao dịch", field: "payment_status" },
              ],
              getExtraItems: (row) => [
                {
                  label: "Đối soát",
                  icon: "pi pi-sync",
                  command: () => openEdit(row),
                },
              ],
              excel: { fileName: "admin-payments.xlsx" },
            }}
          />
        )}
      </CoreCard>

      <CoreDialog
        header={
          edit ? `Đối soát thanh toán #${edit.payment_id} — đơn #${edit.order_id}` : "Đối soát thanh toán"
        }
        visible={edit != null}
        modal
        onHide={closeEdit}
        breakpoints={{ "960px": "100vw" }}
      >
        <p className="text-sm text-[#666666] mt-0">
          Cập nhật dữ liệu đã lưu (mã giao dịch, số tiền, thời điểm, trạng thái). Không thực hiện giao dịch mới trên cổng tại đây.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <label className="text-sm font-semibold">
            Trạng thái giao dịch
            <select
              className="admin-form-control w-full mt-1"
              value={form.payment_status}
              onChange={(e) => setForm((f) => ({ ...f, payment_status: e.target.value }))}
            >
              <option value="pending">pending</option>
              <option value="success">success</option>
              <option value="failed">failed</option>
              <option value="paid">paid</option>
            </select>
          </label>
          <label className="text-sm font-semibold">
            Mã giao dịch
            <input
              className="admin-form-control w-full mt-1"
              value={form.transaction_code}
              onChange={(e) => setForm((f) => ({ ...f, transaction_code: e.target.value }))}
              placeholder="Mã giao dịch từ cổng / ngân hàng"
            />
          </label>
          <label className="text-sm font-semibold">
            Số tiền đã thu (đ)
            <input
              className="admin-form-control w-full mt-1"
              value={form.paid_amount}
              onChange={(e) => setForm((f) => ({ ...f, paid_amount: e.target.value }))}
              placeholder="Để trống nếu chưa xác định"
            />
          </label>
          <label className="text-sm font-semibold">
            Thời gian thanh toán
            <input
              type="datetime-local"
              className="admin-form-control w-full mt-1"
              value={form.paid_at}
              onChange={(e) => setForm((f) => ({ ...f, paid_at: e.target.value }))}
            />
          </label>
        </div>

        <div className="flex gap-2 mt-4">
          <CoreButton type="button" disabled={saving} label={saving ? "Đang lưu…" : "Lưu đối soát"} onClick={saveEdit} />
          <CoreButton type="button" tone="secondary" disabled={saving} label="Hủy" onClick={closeEdit} />
        </div>
      </CoreDialog>

      <CoreDialog
        header={detailId ? `Chi tiết thanh toán #${detailId}` : "Chi tiết thanh toán"}
        visible={detailId != null}
        modal
        onHide={closeDetail}
        breakpoints={{ "960px": "100vw" }}
      >
        {detailLoading ? <div className="text-sm text-[#666666]">Đang tải chi tiết…</div> : null}
        {detailErr ? <CoreMessage severity="error" text={detailErr} className="mt-2" /> : null}
        {detail && !detailLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <CoreCard>
                <div className="font-extrabold mb-2">Giao dịch</div>
                <ul className="text-sm text-[#334155] space-y-1">
                  <li>
                    Phương thức: {payMethodLabel(detail.payment_method)}
                    {detail.payment_gateway ? ` · ${detail.payment_gateway}` : ""}
                  </li>
                  <li>Trạng thái GD: {payRowStatusLabel(detail.payment_status)}</li>
                  <li>Mã giao dịch: {detail.transaction_code || "—"}</li>
                  <li>
                    Số tiền: {money(displayAmount(detail))}đ{detail.currency ? ` (${detail.currency})` : ""}
                  </li>
                  <li>Thời gian thanh toán: {detail.paid_at ? fmtDt(detail.paid_at) : "—"}</li>
                  {detail.is_abnormal ? <li className="text-[#8b2942] font-bold">Bất thường: có — cần đối soát</li> : null}
                  {detail.error_code ? (
                    <li>
                      Mã lỗi: <span className="font-mono">{detail.error_code}</span>
                    </li>
                  ) : null}
                  {detail.buyer_message ? <li>Thông báo cho khách: {detail.buyer_message}</li> : null}
                  {detail.failure_reason ? <li className="text-[#b00020]">Lỗi / từ chối: {detail.failure_reason}</li> : null}
                  {detail.refund_amount != null ? <li>Đã hoàn qua cổng: {money(detail.refund_amount)}đ</li> : null}
                </ul>
              </CoreCard>

              <CoreCard>
                <div className="font-extrabold mb-2">Đơn hàng #{detail.order?.order_id}</div>
                <ul className="text-sm text-[#334155] space-y-1">
                  <li>Tổng đơn: {money(detail.order?.total_amount)}đ</li>
                  <li>TT đơn: {orderPayLabel(detail.order?.payment_status)}</li>
                  <li>
                    Khách: {detail.order?.user?.full_name} — {detail.order?.user?.email}
                    {detail.order?.user?.phone ? ` · ${detail.order.user.phone}` : ""}
                  </li>
                  <li>
                    <Link to="/admin/don-hang" className="underline font-semibold">
                      Mở trang Đơn hàng
                    </Link>{" "}
                    <span className="text-[#666666]">(tìm #{detail.order?.order_id})</span>
                  </li>
                </ul>
              </CoreCard>
            </div>

            {detail.order?.order_items?.length ? (
              <CoreCard>
                <div className="font-extrabold mb-2">Sản phẩm trong đơn</div>
                <ul className="text-sm text-[#334155] space-y-1">
                  {detail.order.order_items.map((oi) => (
                    <li key={oi.order_item_id}>
                      {oi.product?.product_name || "SP"} × {oi.quantity} — {money(oi.line_total)}đ{" "}
                      {oi.product?.sku ? <span className="text-[#666666] ml-2">{oi.product.sku}</span> : null}
                    </li>
                  ))}
                </ul>
              </CoreCard>
            ) : null}

            {detail.order?.refund_requests?.length ? (
              <CoreCard>
                <div className="font-extrabold mb-2">Yêu cầu hoàn tiền</div>
                <ul className="text-sm text-[#334155] space-y-1">
                  {detail.order.refund_requests.map((r) => (
                    <li key={r.refund_request_id}>
                      #{r.refund_request_id} · {r.refund_status} · {money(r.refund_amount)}đ
                    </li>
                  ))}
                </ul>
                <Link to="/admin/hoan-tien" className="underline font-semibold">
                  Quản lý hoàn tiền
                </Link>
              </CoreCard>
            ) : null}
          </div>
        ) : null}
      </CoreDialog>
    </div>
  );
}
