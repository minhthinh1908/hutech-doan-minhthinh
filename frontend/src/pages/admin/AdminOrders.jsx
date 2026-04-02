import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPatch } from "../../api/client.js";
import {
  paymentStatusAdminLabel,
  paymentLogSourceLabel,
  PAYMENT_STATUS_OPTIONS
} from "../../utils/paymentStatusLabels.js";
import { CoreCard, CoreDialog, CoreFilterActions, CoreMessage, CoreSpinner, CoreTable } from "../../components/ui/index.js";
import useAdminToastNotices from "../../hooks/useAdminToastNotices.js";

function money(n) {
  return Number(n || 0).toLocaleString("vi-VN");
}

function fmtLogDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

/** Trạng thái chuẩn admin (đồng bộ use case) */
const ORDER_STATUS_OPTIONS = [
  { value: "pending", label: "Chờ xử lý" },
  { value: "confirmed", label: "Đã xác nhận" },
  { value: "shipping", label: "Đang giao" },
  { value: "completed", label: "Hoàn thành" },
  { value: "cancelled", label: "Đã hủy" }
];

function payMethodVi(code) {
  const m = { cod: "COD", bank_transfer: "Chuyển khoản", payment_gateway: "Cổng TT" };
  return m[code] || code || "—";
}

function statusLabel(value) {
  const o = ORDER_STATUS_OPTIONS.find((x) => x.value === value);
  if (o) return o.label;
  const legacy = { processing: "Đang xử lý (cũ)", shipped: "Đang giao (cũ)" };
  return legacy[value] || value || "—";
}

function selectOptionsForOrder(currentStatus) {
  const opts = [...ORDER_STATUS_OPTIONS];
  if (currentStatus && !opts.some((o) => o.value === currentStatus)) {
    opts.push({ value: currentStatus, label: `${currentStatus} (dữ liệu cũ)` });
  }
  return opts;
}

function selectOptionsForPayment(current) {
  const opts = [...PAYMENT_STATUS_OPTIONS];
  const c = current != null ? String(current) : "";
  if (c && !opts.some((o) => o.value === c)) {
    opts.unshift({ value: c, label: `${c} (dữ liệu cũ)` });
  }
  return opts;
}

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "Tất cả trạng thái" },
  ...ORDER_STATUS_OPTIONS,
  { value: "processing", label: "Đang xử lý (cũ)" },
  { value: "shipped", label: "Đang giao (cũ)" }
];

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortField, setSortField] = useState("order_id");
  const [sortOrder, setSortOrder] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  useAdminToastNotices({ err, msg, setErr, setMsg });
  const [statusFilter, setStatusFilter] = useState("all");
  /** Ô nhập mã đơn (tức thời) */
  const [orderIdInput, setOrderIdInput] = useState("");
  /** Giá trị gửi API sau debounce */
  const [orderIdDebounced, setOrderIdDebounced] = useState("");
  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState("");

  useEffect(() => {
    const trimmed = orderIdInput.trim();
    if (!trimmed) {
      setOrderIdDebounced("");
      return undefined;
    }
    const t = setTimeout(() => setOrderIdDebounced(trimmed), 350);
    return () => clearTimeout(t);
  }, [orderIdInput]);

  const load = useCallback(async () => {
    const params = {};
    if (statusFilter && statusFilter !== "all") params.order_status = statusFilter;
    const q = orderIdDebounced.replace(/^#/, "");
    if (q) params.q = q;
    params.page = Math.floor(first / rowsPerPage) + 1;
    params.limit = rowsPerPage;
    params.sortField = sortField;
    params.sortOrder = sortOrder;
    const data = await apiGet("/admin/orders", params);
    if (Array.isArray(data)) {
      setOrders(data);
      setTotalRecords(data.length);
      return;
    }
    setOrders(Array.isArray(data?.items) ? data.items : []);
    setTotalRecords(Number(data?.total) || 0);
  }, [statusFilter, orderIdDebounced, first, rowsPerPage, sortField, sortOrder]);

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

  async function openDetail(orderId) {
    setDetailId(orderId);
    setDetail(null);
    setDetailErr("");
    setDetailLoading(true);
    try {
      const data = await apiGet(`/admin/orders/${orderId}`);
      setDetail(data);
    } catch (e) {
      setDetailErr(e.message || "Không tải chi tiết đơn.");
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setDetailId(null);
    setDetail(null);
    setDetailErr("");
  }

  async function setStatus(orderId, order_status) {
    setErr("");
    setMsg("");
    try {
      await apiPatch(`/admin/orders/${orderId}`, { order_status }, { auth: true });
      setMsg("Đã cập nhật trạng thái đơn.");
      await load();
      setDetail((d) =>
        d && String(d.order_id) === String(orderId) ? { ...d, order_status } : d
      );
    } catch (e) {
      setErr(e.message || "Không cập nhật được dữ liệu.");
    }
  }

  async function setPaymentStatus(orderId, payment_status) {
    setErr("");
    setMsg("");
    try {
      await apiPatch(`/admin/orders/${orderId}`, { payment_status }, { auth: true });
      setMsg("Đã cập nhật trạng thái thanh toán.");
      await load();
      if (detailId === String(orderId)) {
        try {
          const data = await apiGet(`/admin/orders/${orderId}`);
          setDetail(data);
        } catch {
          setDetail((d) => (d ? { ...d, payment_status } : d));
        }
      }
    } catch (e) {
      setErr(e.message || "Không cập nhật được dữ liệu.");
    }
  }

  return (
    <div className="admin-page">
      <h1 className="admin-section-title">Đơn hàng</h1>
      <p className="admin-lead mt-2 max-w-4xl">
        Đơn từ khách đã đăng nhập — xem danh sách, chi tiết, <strong>trạng thái thanh toán</strong> (kể cả sau cổng thanh toán /
        webhook) và cập nhật trạng thái giao hàng (pending → confirmed → shipping → completed / cancelled).
      </p>

      <CoreCard className="mt-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex flex-col gap-2">
            <div className="text-xs font-extrabold uppercase tracking-wide text-[#666666]">Lọc theo trạng thái</div>
            <select
              className="admin-form-control min-w-[220px]"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setFirst(0);
              }}
              aria-label="Lọc theo trạng thái đơn"
            >
              {STATUS_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 flex flex-col gap-2">
            <div className="text-xs font-extrabold uppercase tracking-wide text-[#666666]">Tìm mã đơn</div>
            <input
              type="search"
              className="admin-form-control"
              placeholder="Ví dụ: 42 hoặc #42"
              value={orderIdInput}
              onChange={(e) => {
                setOrderIdInput(e.target.value);
                setFirst(0);
              }}
              aria-label="Tìm theo mã đơn (số)"
            />
          </div>

          <CoreFilterActions
            mode="clearOnly"
            onClear={() => {
              setStatusFilter("all");
              setOrderIdInput("");
              setFirst(0);
            }}
            buttonClassName="!px-3 !py-1.5 text-sm"
          />
        </div>
      </CoreCard>

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-10">
          <CoreSpinner className="h-8 w-8" />
          <span className="text-[#666666] font-semibold">Đang tải dữ liệu…</span>
        </div>
      ) : (
        <CoreTable
          value={orders}
          dataKey="order_id"
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
            setSortField(e.sortField || "order_id");
            setSortOrder(e.sortOrder ?? -1);
            setFirst(0);
          }}
          className="mt-4"
          emptyMessage={
            statusFilter !== "all" || orderIdDebounced ? "Không có đơn phù hợp bộ lọc / mã đơn." : "Chưa có đơn hàng nào."
          }
          columns={[
            { key: "id", header: "ID", field: "order_id", sortable: true, body: (row) => `#${row.order_id}` },
            {
              key: "user",
              header: "Khách",
              body: (row) => (
                <div>
                  <div className="font-semibold">{row.user?.full_name || "—"}</div>
                  <div className="text-xs text-[#666666]">{row.user?.email || ""}</div>
                </div>
              ),
            },
            { key: "total", header: "Tổng", field: "total_amount", sortable: true, body: (row) => `${money(row.total_amount)}đ` },
            {
              key: "os",
              header: "TT đơn",
              body: (row) => (
                <select
                  className="admin-form-control min-w-[180px] py-1.5 text-xs"
                  value={row.order_status}
                  onChange={(e) => setStatus(row.order_id, e.target.value)}
                  aria-label="Trạng thái đơn"
                >
                  {selectOptionsForOrder(row.order_status).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ),
            },
            {
              key: "ps",
              header: "TT thanh toán",
              body: (row) => (
                <select
                  className="admin-form-control min-w-[190px] py-1.5 text-xs"
                  value={String(row.payment_status || "pending")}
                  onChange={(e) => setPaymentStatus(row.order_id, e.target.value)}
                  aria-label="Trạng thái thanh toán"
                >
                  {PAYMENT_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ),
            },
            {
              key: "date",
              header: "Ngày đặt",
              field: "order_date",
              sortable: true,
              body: (row) => (row.order_date ? new Date(row.order_date).toLocaleString("vi-VN") : "—"),
            },
          ]}
          actionConfig={{
            onView: (row) => openDetail(row.order_id),
            copyFields: [
              { label: "Mã đơn", field: "order_id" },
              { label: "Trạng thái đơn", field: "order_status" },
              { label: "Trạng thái thanh toán", field: "payment_status" },
            ],
            excel: { fileName: "admin-orders.xlsx" },
          }}
        />
      )}

      <CoreDialog
        header={detailId ? `Chi tiết đơn #${detailId}` : "Chi tiết đơn"}
        visible={detailId != null}
        modal
        onHide={closeDetail}
        breakpoints={{ "960px": "100vw" }}
      >
        {detailLoading ? <div className="text-sm text-[#666666]">Đang tải chi tiết…</div> : null}
        {detailErr ? <CoreMessage severity="error" text={detailErr} className="mt-2" /> : null}
        {detail && !detailLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
              <div className="space-y-1">
                <div className="font-bold">Khách</div>
                <div>{detail.user?.full_name}</div>
                <div className="text-xs text-[#666666]">{detail.user?.email}</div>
                {detail.user?.phone ? <div className="text-xs text-[#666666]">{detail.user.phone}</div> : null}
              </div>
              {detail.shipping_address ? (
                <div className="sm:col-span-2 lg:col-span-4 space-y-1">
                  <div className="font-bold">Địa chỉ giao hàng</div>
                  <div className="text-[#666666] whitespace-pre-wrap">{detail.shipping_address}</div>
                </div>
              ) : null}
              <div className="space-y-1">
                <div className="font-bold">Trạng thái</div>
                <div>
                  Đơn: {statusLabel(detail.order_status)}
                  <br />
                  Thanh toán: {paymentStatusAdminLabel(detail.payment_status)}
                </div>
              </div>
              <div className="space-y-1">
                <div className="font-bold">Tổng tiền</div>
                <div>
                  Tạm tính: {money(detail.subtotal)}đ
                  <br />
                  Giảm giá: {money(detail.discount_amount)}đ
                  <br />
                  <strong>Thành tiền: {money(detail.total_amount)}đ</strong>
                </div>
              </div>
              <div className="space-y-1">
                <div className="font-bold">Ngày đặt</div>
                <div>{detail.order_date ? new Date(detail.order_date).toLocaleString("vi-VN") : "—"}</div>
              </div>
            </div>

            {detail.order_vouchers?.length ? (
              <CoreCard>
                <div className="font-bold mb-2">Voucher</div>
                <ul className="list-disc pl-5 text-sm">
                  {detail.order_vouchers.map((ov) => (
                    <li key={ov.order_voucher_id}>
                      {ov.voucher?.code || "—"} — giảm {money(ov.discount_amount)}đ
                    </li>
                  ))}
                </ul>
              </CoreCard>
            ) : null}

            {detail.payments?.length ? (
              <CoreCard>
                <div className="font-bold mb-2">Lịch sử thanh toán (dữ liệu đã lưu)</div>
                <CoreTable
                  value={detail.payments}
                  paginator={false}
                  columns={[
                    { key: "m", header: "payment_method", body: (p) => payMethodVi(p.payment_method) },
                    { key: "s", header: "payment_status", body: (p) => paymentStatusAdminLabel(p.payment_status) },
                    { key: "t", header: "transaction_code", body: (p) => p.transaction_code || "—" },
                    { key: "a", header: "paid_amount", body: (p) => (p.paid_amount != null ? `${money(p.paid_amount)}đ` : "—") },
                    { key: "at", header: "paid_at", body: (p) => (p.paid_at ? new Date(p.paid_at).toLocaleString("vi-VN") : "—") },
                  ]}
                />
                <div className="text-xs text-[#666666] mt-2">
                  Đối soát &amp; tra cứu toàn hệ thống: Admin → Thanh toán / Đối soát.
                </div>
              </CoreCard>
            ) : null}

            <CoreCard>
              <div className="font-bold mb-2">Sản phẩm</div>
              <CoreTable
                value={detail.order_items || []}
                paginator={false}
                columns={[
                  { key: "p", header: "Sản phẩm", body: (row) => row.product?.product_name || `#${row.product_id}` },
                  { key: "q", header: "SL", field: "quantity" },
                  { key: "u", header: "Đơn giá", body: (row) => `${money(row.unit_price)}đ` },
                  { key: "l", header: "Thành tiền", body: (row) => `${money(row.line_total)}đ` },
                ]}
              />
            </CoreCard>

            <CoreCard>
              <div className="font-bold mb-3">Cập nhật trạng thái</div>
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 space-y-1">
                  <div className="text-sm font-semibold">Đổi trạng thái đơn</div>
                  <select
                    className="admin-form-control"
                    value={detail.order_status}
                    onChange={(e) => setStatus(detail.order_id, e.target.value)}
                  >
                    {selectOptionsForOrder(detail.order_status).map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 space-y-1">
                  <div className="text-sm font-semibold">Thanh toán (đơn)</div>
                  <select
                    className="admin-form-control"
                    value={String(detail.payment_status || "pending")}
                    onChange={(e) => setPaymentStatus(detail.order_id, e.target.value)}
                  >
                    {selectOptionsForPayment(detail.payment_status).map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CoreCard>
          </div>
        ) : null}
      </CoreDialog>
    </div>
  );
}
