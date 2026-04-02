import { useEffect, useState } from "react";
import { apiGet, apiPatch } from "../../api/client.js";
import {
  REPAIR_PRIMARY_FLOW,
  REPAIR_STATUS_LABELS,
  REPAIR_STATUS_ORDER,
  repairStatusLabel
} from "../../utils/repairStatusConfig.js";
import { CoreBadge, CoreButton, CoreCard, CoreDialog, CoreFilterActions, CoreMessage, CoreSpinner, CoreTable } from "../../components/ui/index.js";
import useAdminToastNotices from "../../hooks/useAdminToastNotices.js";

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
  useAdminToastNotices({ err, setErr });
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
      setErr(e.message || "Không tải được dữ liệu.");
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
      setErr(e.message || "Không tải được dữ liệu.");
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
    <div className="admin-page">
      <h1 className="admin-section-title">Yêu cầu sửa chữa</h1>
      <p className="admin-lead">
        Tiếp nhận và xử lý yêu cầu từ khách (trang «Xem bảo hành»). Luồng trạng thái chính:{" "}
        {REPAIR_PRIMARY_FLOW.map((s) => REPAIR_STATUS_LABELS[s]).join(" → ")}. Tìm kiếm, lọc và mở chi tiết để cập nhật
        trạng thái và ghi chú xử lý.
      </p>

      <CoreCard>
        <form className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3" onSubmit={applyFilters}>
          <div className="xl:col-span-2">
            <span className="block text-xs font-extrabold uppercase tracking-wide text-[#666666] mb-1">Tìm kiếm</span>
          <input
              className="admin-form-control w-full"
            placeholder="Mã YC, tên, email, sản phẩm, mô tả…"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          />
        </div>
          <div>
            <span className="block text-xs font-extrabold uppercase tracking-wide text-[#666666] mb-1">Trạng thái</span>
          <select
              className="admin-form-control w-full"
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
          <div>
            <span className="block text-xs font-extrabold uppercase tracking-wide text-[#666666] mb-1">Từ ngày</span>
          <input
            type="date"
              className="admin-form-control w-full"
            value={filters.dateFrom}
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
          />
        </div>
          <div>
            <span className="block text-xs font-extrabold uppercase tracking-wide text-[#666666] mb-1">Đến ngày</span>
          <input
            type="date"
              className="admin-form-control w-full"
            value={filters.dateTo}
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
          />
        </div>
          <div>
            <span className="block text-xs font-extrabold uppercase tracking-wide text-[#666666] mb-1">Bảo hành</span>
          <select
              className="admin-form-control w-full"
            value={filters.warranty}
            onChange={(e) => setFilters((f) => ({ ...f, warranty: e.target.value }))}
          >
            <option value="all">Tất cả</option>
            <option value="active">Còn hiệu lực</option>
            <option value="expired">Hết hạn / không còn</option>
          </select>
        </div>
          <div className="flex items-end">
            <CoreFilterActions
              applyType="submit"
              onClear={() => resetFiltersAndLoad()}
              buttonClassName="!px-3 !py-1.5 text-sm"
            />
          </div>
        </form>
      </CoreCard>

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-10">
          <CoreSpinner />
          <span className="text-[#666666] font-semibold">Đang tải dữ liệu…</span>
        </div>
      ) : null}

      {!loading && rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E5E5E5] bg-[#F5F5F5] p-8 text-center text-[#666666]">
          Không có yêu cầu sửa chữa nào khớp bộ lọc.
        </div>
      ) : null}

      {!loading && rows.length > 0 ? (
        <CoreCard>
          <CoreTable
            value={rows}
            dataKey="repair_request_id"
            rows={10}
            columns={[
              { key: "id", header: "ID", field: "repair_request_id" },
              {
                key: "user",
                header: "Khách hàng",
                body: (r) => (
                  <div>
                    <div>{r.user?.full_name || "—"}</div>
                    <div className="text-xs text-[#666666]">{r.user?.email || ""}</div>
                  </div>
                ),
              },
              { key: "product", header: "Sản phẩm", body: (r) => r.warranty?.order_item?.product?.product_name || "—" },
              { key: "warranty", header: "Mã bảo hành", body: (r) => r.warranty_id },
              { key: "date", header: "Ngày gửi", body: (r) => r.request_date?.slice?.(0, 10) || "—" },
              {
                key: "status",
                header: "Trạng thái",
                body: (r) => <CoreBadge value={repairStatusLabel(r.repair_status)} tone="info" />,
              },
            ]}
            actionConfig={{
              onView: (row) => openDetail(row.repair_request_id),
              copyFields: [
                { label: "Mã yêu cầu", field: "repair_request_id" },
                { label: "Trạng thái", field: "repair_status" },
                { label: "Mã bảo hành", field: "warranty_id" },
              ],
              excel: { fileName: "admin-repairs.xlsx" },
            }}
          />
        </CoreCard>
      ) : null}

      <CoreDialog
        header={detailId ? `Chi tiết yêu cầu #${detailId}` : "Chi tiết yêu cầu"}
        visible={detailId != null}
        modal
        onHide={closeDetail}
        breakpoints={{ "960px": "100vw" }}
      >
              {detailLoading ? <p className="text-sm text-[#666666]">Đang tải chi tiết…</p> : null}
              {detailErr ? (
          <CoreMessage severity="error" text={detailErr} />
              ) : null}
              {!detailLoading && detail ? (
                <>
            <div className="space-y-4">
              <CoreCard>
                    <h3>Khách hàng</h3>
                <dl className="grid grid-cols-[120px_1fr] gap-y-1 text-sm">
                      <dt>Họ tên</dt>
                      <dd>{detail.user?.full_name || "—"}</dd>
                      <dt>Email</dt>
                      <dd>{detail.user?.email || "—"}</dd>
                      <dt>Số điện thoại</dt>
                      <dd>{detail.user?.phone || "—"}</dd>
                    </dl>
              </CoreCard>
              <CoreCard>
                    <h3>Sản phẩm &amp; đơn hàng</h3>
                <dl className="grid grid-cols-[120px_1fr] gap-y-1 text-sm">
                      <dt>Sản phẩm</dt>
                      <dd>{detail.warranty?.order_item?.product?.product_name || "—"}</dd>
                      <dt>SKU</dt>
                      <dd>{detail.warranty?.order_item?.product?.sku || "—"}</dd>
                      <dt>Mã đơn</dt>
                      <dd>{detail.warranty?.order_item?.order?.order_id ?? "—"}</dd>
                    </dl>
              </CoreCard>
              <CoreCard>
                    <h3>Bảo hành</h3>
                <dl className="grid grid-cols-[120px_1fr] gap-y-1 text-sm">
                      <dt>Mã phiếu</dt>
                      <dd>{detail.warranty_id}</dd>
                      <dt>Từ — đến</dt>
                      <dd>
                        {detail.warranty?.start_date?.slice?.(0, 10) || "—"} — {detail.warranty?.end_date?.slice?.(0, 10) || "—"}
                      </dd>
                      <dt>Trạng thái phiếu</dt>
                      <dd>{detail.warranty?.status || "—"}</dd>
                    </dl>
              </CoreCard>
              <CoreCard>
                    <h3>Mô tả lỗi (khách)</h3>
                    <p className="m-0 text-sm leading-relaxed">{detail.issue_description}</p>
              </CoreCard>
              <CoreCard>
                    <h3>Ảnh đính kèm</h3>
                    {parseAttachments(detail.attachment_urls).length === 0 ? (
                  <p className="text-sm text-[#666666]">Không có ảnh.</p>
                    ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {parseAttachments(detail.attachment_urls).map((url) => (
                          <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt="" className="w-full h-24 object-cover rounded border border-[#E5E5E5]" />
                          </a>
                        ))}
                      </div>
                    )}
              </CoreCard>
              <CoreCard>
                    <h3>Trạng thái hiện tại</h3>
                    <p className="m-0">
                  <CoreBadge value={repairStatusLabel(detail.repair_status)} tone="info" />
                      {detail.completed_at ? (
                        <span className="ml-2 text-xs text-[#666666]">
                          Hoàn tất lúc: {new Date(detail.completed_at).toLocaleString("vi-VN")}
                        </span>
                      ) : null}
                    </p>
              </CoreCard>

              <CoreCard>
                <form onSubmit={submitForm}>
                      <h3>Cập nhật xử lý</h3>
                  <label className="block mb-3">
                        Trạng thái
                        <select
                      className="admin-form-control w-full mt-1"
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
                  <label className="block mb-3">
                        Ghi chú nội bộ (admin)
                        <textarea
                      className="admin-form-control w-full mt-1"
                          value={form.admin_notes}
                          onChange={(e) => setForm((f) => ({ ...f, admin_notes: e.target.value }))}
                          placeholder="Ghi chú không hiển thị cho khách…"
                        />
                      </label>
                  <label className="block mb-3">
                        Kết quả / phản hồi cho khách
                        <textarea
                      className="admin-form-control w-full mt-1"
                          value={form.resolution_notes}
                          onChange={(e) => setForm((f) => ({ ...f, resolution_notes: e.target.value }))}
                          placeholder="Mô tả kết quả sửa chữa, hướng dẫn nhận máy…"
                        />
                      </label>
                  <label className="block mb-3">
                        Ngày dự kiến hoàn tất
                        <input
                          type="date"
                      className="admin-form-control w-full mt-1"
                          value={form.expected_completion_date}
                          onChange={(e) => setForm((f) => ({ ...f, expected_completion_date: e.target.value }))}
                        />
                      </label>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <CoreButton type="submit" label={saving ? "Đang lưu…" : "Lưu thay đổi"} disabled={saving} />
                    <CoreButton
                        type="button"
                      tone="secondary"
                      label="Đánh dấu hoàn tất"
                        disabled={saving}
                        onClick={() => saveDetail({ repair_status: "completed" })}
                    />
                    <CoreButton
                        type="button"
                      tone="danger"
                      label="Từ chối yêu cầu"
                        disabled={saving}
                        onClick={() => {
                          if (window.confirm("Từ chối yêu cầu này?")) saveDetail({ repair_status: "rejected" });
                        }}
                    />
                  </div>
                  <p className="text-xs text-[#666666] mt-2">
                      «Đánh dấu hoàn tất» đặt trạng thái <strong>completed</strong> và ghi nhận thời điểm hoàn tất (nếu chưa có).
                    </p>
                </form>
              </CoreCard>
            </div>
                </>
              ) : null}
      </CoreDialog>
    </div>
  );
}
