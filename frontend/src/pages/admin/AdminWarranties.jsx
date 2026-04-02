import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPatch } from "../../api/client.js";
import { repairStatusLabel } from "../../utils/repairStatusConfig.js";
import { CoreBadge, CoreButton, CoreCard, CoreSpinner, CoreTable } from "../../components/ui/index.js";
import useAdminToastNotices from "../../hooks/useAdminToastNotices.js";

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

function warrantyStatusTone(status, daysRemaining) {
  if (status === "active" && daysRemaining != null && Number(daysRemaining) < 0) return "danger";
  if (status === "expired") return "danger";
  if (status === "pending") return "warn";
  if (status === "void") return "neutral";
  if (status === "claimed") return "info";
  return "success";
}

export default function AdminWarranties() {
  const [rows, setRows] = useState(
    /** @type {AdminWarrantyItem[]} */
    ([])
  );
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  useAdminToastNotices({ err, setErr });
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
        if (!cancelled) setErr(e.message || "Không tải được dữ liệu.");
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
      setErr(e.message || "Không cập nhật được dữ liệu.");
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
      setErr(e.message || "Không lưu được dữ liệu.");
    } finally {
      setSavingId(null);
    }
  }

  const empty = !loading && rows.length === 0;
  const statusOptions = [
    { value: "active", label: "Đang hiệu lực" },
    { value: "pending", label: "Chờ kích hoạt" },
    { value: "claimed", label: "Đã kích hoạt / yêu cầu" },
    { value: "expired", label: "Hết hạn" },
    { value: "void", label: "Vô hiệu" },
  ];

  const columns = [
    { key: "code", header: "Mã phiếu", body: (w) => w.warranty_code ?? `BH-${w.warranty_id}` },
    { key: "order", header: "Mã đơn", body: (w) => w.order_code ?? "—" },
    {
      key: "user",
      header: "Khách",
      body: (w) => (
        <div>
          <div>{w.user_name || "—"}</div>
          {w.user_phone ? <div className="text-xs text-[#666666]">{w.user_phone}</div> : null}
        </div>
      ),
    },
    {
      key: "product",
      header: "Sản phẩm",
      body: (w) => (
        <div>
          <div>{w.product_name}</div>
          {w.product_sku ? <div className="text-xs text-[#666666]">{w.product_sku}</div> : null}
        </div>
      ),
    },
    { key: "end", header: "Đến ngày", body: (w) => formatDateShort(w.end_date) },
    { key: "remain", header: "Còn / quá hạn", body: (w) => daysRemainingLabel(w.days_remaining) },
    {
      key: "status",
      header: "Trạng thái",
      body: (w) => (
        <CoreBadge
          value={warrantyStatusLabelVi(w.status, w.days_remaining)}
          tone={warrantyStatusTone(w.status, w.days_remaining)}
          className="whitespace-nowrap"
        />
      ),
    },
    {
      key: "repair",
      header: "Sửa chữa",
      body: (w) =>
        w.repair_request_count ? (
          <div>
            <strong>{w.repair_request_count}</strong>
            {w.latest_repair_status ? (
              <div className="text-xs text-[#666666]">{repairStatusLabel(w.latest_repair_status)}</div>
            ) : null}
          </div>
        ) : (
          "—"
        ),
    },
    {
      key: "change",
      header: "Đổi TT",
      body: (w) => (
        <select
          className="admin-form-control min-w-[170px] py-1.5 text-xs"
          value={w.status}
          onChange={(e) => setStatus(w.warranty_id, e.target.value)}
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: "note",
      header: "Ghi chú admin",
      body: (w) => {
        const id = String(w.warranty_id);
        const draft = draftAdminNote[id] ?? "";
        return (
          <div className="min-w-[220px]">
            <textarea
              className="admin-form-control w-full"
              rows={3}
              value={draft}
              onChange={(e) =>
                setDraftAdminNote((prev) => ({
                  ...prev,
                  [id]: e.target.value,
                }))
              }
              placeholder="Nội bộ (admin_note)…"
            />
            <CoreButton
              type="button"
              className="mt-2"
              disabled={savingId === w.warranty_id}
              label={savingId === w.warranty_id ? "Đang lưu…" : "Lưu"}
              onClick={() => saveAdminNote(w.warranty_id)}
            />
          </div>
        );
      },
    },
  ];

  return (
    <div className="admin-page">
      <h1 className="admin-section-title">Bảo hành</h1>
      <p className="admin-lead">
        Phiếu gắn <strong>order_item</strong> (dòng đơn). Trạng thái <strong>Chờ kích hoạt</strong> = khách chưa bấm kích hoạt
        sau khi nhận hàng; cột <strong>Còn / quá hạn</strong> và <strong>Hết hạn</strong> theo ngày kết thúc sau khi đã kích hoạt.
        Khách thao tác tại «Xem bảo hành» / chi tiết đơn.
      </p>

      <CoreCard>
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-10">
            <CoreSpinner />
            <span className="text-[#666666] font-semibold">Đang tải dữ liệu…</span>
          </div>
        ) : (
          <>
            <CoreTable
              value={rows}
              dataKey="warranty_id"
              rows={10}
              emptyMessage="Không có phiếu bảo hành."
              columns={columns}
              actionConfig={{
                copyFields: [
                  { label: "Mã phiếu", field: "warranty_code" },
                  { label: "Mã đơn", field: "order_code" },
                  { label: "Khách", field: "user_name" },
                ],
                excel: { fileName: "admin-warranties.xlsx" },
              }}
            />

            {empty ? (
              <div className="mt-4 rounded-xl border border-[#E5E5E5] bg-[#F5F5F5] p-4" aria-label="Ví dụ minh họa">
                <p className="font-bold">Ví dụ 3 khách (minh họa)</p>
                <p className="text-sm text-[#666666]">
                  Khi có phiếu thật (hoặc sau <code>npx prisma db seed</code>), bảng trên
                  hiển thị dữ liệu thực; dưới đây là cách đọc cột với 2–3 người khác nhau.
                </p>
                <CoreTable
                  value={EXAMPLE_ROWS}
                  className="mt-3"
                  paginator={false}
                  columns={[
                    { key: "w", header: "Mã phiếu", field: "warranty_code" },
                    { key: "o", header: "Mã đơn", field: "order_code" },
                    { key: "u", header: "Khách", field: "user_name" },
                    { key: "p", header: "Sản phẩm", body: (row) => `${row.product_name} (${row.product_sku})` },
                    { key: "d", header: "Đến ngày", body: (row) => formatDateShort(row.end_date) },
                    { key: "r", header: "Còn / quá hạn", body: (row) => daysRemainingLabel(row.days_remaining) },
                    {
                      key: "s",
                      header: "TT",
                      body: (row) => (
                        <CoreBadge
                          value={warrantyStatusLabelVi(row.status, row.days_remaining)}
                          tone={warrantyStatusTone(row.status, row.days_remaining)}
                          className="whitespace-nowrap"
                        />
                      ),
                    },
                    { key: "c", header: "Sửa chữa", body: (row) => row.repair_request_count || "—" },
                  ]}
                />
                <p className="text-sm text-[#666666] mt-3 mb-0">
                  Các trường bổ sung cho admin: <code>repair_request_count</code>, <code>latest_repair_status</code>,{" "}
                  <code>admin_note</code>, <code>is_expired</code>, <code>days_remaining</code>; <code>delivered_at</code>{" "}
                  dùng khi backend có ngày giao trên đơn.
                </p>
              </div>
            ) : null}
          </>
        )}
      </CoreCard>
    </div>
  );
}
