import { useCallback, useEffect, useRef, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost } from "../../api/client.js";
import {
  emptyVoucherForm,
  formToCreatePayload,
  formToUpdatePayload,
  validateVoucherForm,
  voucherRecordToForm
} from "../../utils/voucherAdminUtils.js";
import { CoreBadge, CoreButton, CoreCard, CoreCheckbox, CoreTable } from "../../components/ui/index.js";
import useAdminToastNotices from "../../hooks/useAdminToastNotices.js";

export default function AdminVouchers() {
  const [items, setItems] = useState([]);
  const [categoryTree, setCategoryTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState(() => emptyVoucherForm());
  const [editingId, setEditingId] = useState(null);
  const formAnchorRef = useRef(null);
  useAdminToastNotices({ err, msg, setErr, setMsg });

  const load = useCallback(async () => {
    const [vouchers, tree] = await Promise.all([apiGet("/vouchers"), apiGet("/categories/tree")]);
    setItems(Array.isArray(vouchers) ? vouchers : []);
    setCategoryTree(Array.isArray(tree) ? tree : []);
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

  useEffect(() => {
    if (!editingId) return undefined;
    const t = window.setTimeout(() => {
      formAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(t);
  }, [editingId]);

  function resetForm() {
    setForm(emptyVoucherForm());
    setEditingId(null);
  }

  function startEdit(v) {
    setEditingId(String(v.voucher_id));
    setForm(voucherRecordToForm(v));
    setErr("");
    setMsg("");
  }

  function toggleCategoryId(id) {
    const sid = String(id);
    setForm((f) => {
      const set = new Set(f.selectedCategoryIds || []);
      if (set.has(sid)) set.delete(sid);
      else set.add(sid);
      return { ...f, selectedCategoryIds: [...set] };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    const { ok, errors } = validateVoucherForm(form);
    if (!ok) {
      setErr(errors.join(" "));
      return;
    }
    try {
      if (editingId) {
        const payload = formToUpdatePayload(form);
        await apiPatch(`/vouchers/${editingId}`, payload, { auth: true });
        setMsg("Đã cập nhật voucher.");
        resetForm();
      } else {
        const payload = formToCreatePayload(form);
        await apiPost("/vouchers", payload, { auth: true });
        setMsg("Đã tạo voucher — khách nhập mã ở giỏ hàng khi đặt hàng.");
        resetForm();
      }
      await load();
    } catch (e) {
      setErr(e.message || "Không lưu được dữ liệu.");
    }
  }

  async function removeVoucher(id) {
    if (!window.confirm("Xóa voucher này? Hành động không hoàn tác.")) return;
    setErr("");
    setMsg("");
    try {
      await apiDelete(`/vouchers/${id}`, { auth: true });
      setMsg("Đã xóa voucher.");
      if (String(editingId) === String(id)) resetForm();
      await load();
    } catch (e) {
      setErr(e.message || "Không xóa được dữ liệu.");
    }
  }

  async function toggleStatus(v) {
    const next = String(v.status || "").toLowerCase() === "active" ? "inactive" : "active";
    setErr("");
    try {
      await apiPatch(`/vouchers/${v.voucher_id}`, { status: next }, { auth: true });
      setMsg(next === "active" ? "Đã bật voucher (active)." : "Đã tắt voucher (inactive).");
      await load();
    } catch (e) {
      setErr(e.message || "Không cập nhật được dữ liệu.");
    }
  }

  async function copyCode(code) {
    const text = String(code || "");
    setErr("");
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error("no-clipboard");
      }
    } catch {
      try {
        window.prompt("Sao chép mã:", text);
      } catch {
        setErr("Không sao chép được — hãy chép mã thủ công.");
        return;
      }
    }
    setMsg("Đã copy mã voucher.");
    window.setTimeout(() => setMsg(""), 2500);
  }

  const isPercent = form.discount_type === "percent";

  return (
    <div className="admin-page">
      <h1 className="admin-section-title">Voucher / khuyến mãi</h1>
      <p className="admin-lead">
        Admin tạo và quản lý mã: <strong>loại giảm</strong> (% hoặc cố định), <strong>giá trị</strong>,{" "}
        <strong>điều kiện</strong> (đơn tối thiểu, danh mục), <strong>thời gian</strong> hiệu lực và giới hạn lượt. Cột{" "}
        <strong>Đã dùng / giới hạn</strong> theo dõi số lần sử dụng.
      </p>
      <div ref={formAnchorRef} aria-hidden />
      {editingId ? (
        <CoreCard>
          Đang sửa voucher <strong>{form.code || "…"}</strong>.{" "}
          <button type="button" className="font-semibold underline decoration-[#FFC107] decoration-2 underline-offset-2" onClick={resetForm}>
            Hủy sửa
          </button>
        </CoreCard>
      ) : null}

      <CoreCard>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="admin-form-label">
              Mã voucher
              <input
                required
                className="admin-form-control mt-1"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="VD: SALE10"
              />
            </label>
            <label className="admin-form-label">
              Loại giảm
              <select
                className="admin-form-control mt-1"
                value={form.discount_type}
                onChange={(e) => setForm((f) => ({ ...f, discount_type: e.target.value }))}
              >
                <option value="percent">Phần trăm (%)</option>
                <option value="fixed">Số tiền cố định (đ)</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="admin-form-label">
              {isPercent ? "Giá trị giảm (%)" : "Giá trị giảm (đ)"}
              <input
                required
                type="number"
                className="admin-form-control mt-1"
                min="0"
                step={isPercent ? "0.01" : "1"}
                value={form.discount_value}
                onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))}
              />
            </label>
            <label className="admin-form-label">
              Giảm tối đa (đ) — tùy chọn
              <input
                type="number"
                className="admin-form-control mt-1"
                min="0"
                step="1"
                value={form.max_discount_amount}
                onChange={(e) => setForm((f) => ({ ...f, max_discount_amount: e.target.value }))}
                placeholder="Không giới hạn trần"
                disabled={!isPercent}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="admin-form-label">
              Tổng lượt dùng tối đa
              <input
                type="number"
                className="admin-form-control mt-1"
                min="0"
                value={form.usage_limit}
                onChange={(e) => setForm((f) => ({ ...f, usage_limit: e.target.value }))}
              />
            </label>
            <label className="admin-form-label">
              Mỗi khách tối đa
              <input
                type="number"
                className="admin-form-control mt-1"
                min="0"
                value={form.per_user_limit}
                onChange={(e) => setForm((f) => ({ ...f, per_user_limit: e.target.value }))}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="admin-form-label">
              Bắt đầu
              <input
                required
                type="datetime-local"
                className="admin-form-control mt-1"
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
              />
            </label>
            <label className="admin-form-label">
              Kết thúc
              <input
                required
                type="datetime-local"
                className="admin-form-control mt-1"
                value={form.end_date}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
              />
            </label>
          </div>

          <div className="rounded-xl border border-[#E5E5E5] p-3">
            <div className="font-semibold">Danh mục áp dụng</div>
            <div className="max-h-48 overflow-auto mt-2 space-y-2">
              {categoryTree.map((root) => (
                <div key={root.category_id}>
                  <div className="font-semibold text-sm">{root.category_name}</div>
                  {(root.children || []).map((ch) => {
                    const id = String(ch.category_id);
                    return (
                      <label key={id} className="flex items-center gap-2 text-sm mt-1">
                        <CoreCheckbox checked={form.selectedCategoryIds.includes(id)} onChange={() => toggleCategoryId(id)} />
                        <span>{ch.category_name}</span>
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <CoreButton type="submit" label={editingId ? "Cập nhật voucher" : "Tạo voucher"} disabled={loading} />
            {editingId ? <CoreButton type="button" tone="secondary" label="Hủy" onClick={resetForm} /> : null}
          </div>
        </form>
      </CoreCard>

      <CoreCard>
        <h2 className="admin-section-title">Danh sách voucher</h2>
        <CoreTable
          value={items}
          loading={loading}
          rows={10}
          columns={[
            { key: "code", header: "Mã", body: (v) => <code className="font-bold">{v.code}</code> },
            { key: "type", header: "Loại", body: (v) => (v.discount_type === "fixed" ? "Cố định" : "%") },
            { key: "val", header: "Giá trị", body: (v) => String(v.discount_value) },
            { key: "usage", header: "Đã dùng / giới hạn", body: (v) => `${v.usage_count ?? 0}${v.usage_limit != null ? ` / ${v.usage_limit}` : ""}` },
            { key: "date", header: "Hạn", body: (v) => `${v.start_date?.slice?.(0, 10)} → ${v.end_date?.slice?.(0, 10)}` },
            {
              key: "status",
              header: "TT",
              body: (v) => {
                const active = String(v.status || "").toLowerCase() === "active";
                return <CoreBadge value={active ? "Hoạt động" : "Tắt"} tone={active ? "success" : "neutral"} />;
              },
            },
          ]}
          actionConfig={{
            onEdit: (row) => startEdit(row),
            onDelete: (row) => removeVoucher(row.voucher_id),
            copyFields: [
              { label: "Mã voucher", field: "code" },
              { label: "ID voucher", field: "voucher_id" },
              { label: "Trạng thái", field: "status" },
            ],
            getExtraItems: (row) => {
              const active = String(row.status || "").toLowerCase() === "active";
              return [
                {
                  label: "Copy mã",
                  icon: "pi pi-copy",
                  command: () => copyCode(row.code),
                },
                {
                  label: active ? "Tắt voucher" : "Bật voucher",
                  icon: active ? "pi pi-pause" : "pi pi-play",
                  command: () => toggleStatus(row),
                },
              ];
            },
            excel: { fileName: "admin-vouchers.xlsx" },
          }}
        />
      </CoreCard>
    </div>
  );
}
