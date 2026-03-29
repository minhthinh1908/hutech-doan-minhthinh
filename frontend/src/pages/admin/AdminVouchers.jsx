import { useCallback, useEffect, useRef, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost } from "../../api/client.js";
import {
  emptyVoucherForm,
  formToCreatePayload,
  formToUpdatePayload,
  validateVoucherForm,
  voucherRecordToForm
} from "../../utils/voucherAdminUtils.js";
import "./AdminPages.css";

export default function AdminVouchers() {
  const [items, setItems] = useState([]);
  const [categoryTree, setCategoryTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState(() => emptyVoucherForm());
  const [editingId, setEditingId] = useState(null);

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
        if (!cancelled) setErr(e.message || "Lỗi tải");
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
      setErr(e.message || "Không lưu được");
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
      setErr(e.message || "Không xóa được");
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
      setErr(e.message || "Không cập nhật được trạng thái");
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
      <h1>Voucher / khuyến mãi</h1>
      <p className="admin-page__muted">
        Admin tạo và quản lý mã: <strong>loại giảm</strong> (% hoặc cố định), <strong>giá trị</strong>,{" "}
        <strong>điều kiện</strong> (đơn tối thiểu, danh mục), <strong>thời gian</strong> hiệu lực và giới hạn lượt. Cột{" "}
        <strong>Đã dùng / giới hạn</strong> theo dõi số lần sử dụng. Form phía dưới để tạo/sửa; bảng: Sửa, Copy mã, Tắt/Bật,
        Xóa. Buyer nhập mã ở giỏ hàng và xem số tiền giảm trước khi đặt.
      </p>
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

      <div ref={formAnchorRef} className="admin-voucher-form-anchor" aria-hidden />
      {editingId ? (
        <div className="admin-voucher-edit-banner" role="status">
          Đang sửa voucher <strong>{form.code || "…"}</strong> — chỉnh form bên dưới rồi bấm{" "}
          <strong>Cập nhật voucher</strong>, hoặc{" "}
          <button type="button" className="admin-inline-link" onClick={resetForm}>
            Hủy sửa
          </button>
          .
        </div>
      ) : null}

      <form
        className={`admin-form admin-form--wide admin-voucher-form${editingId ? " admin-voucher-form--editing" : ""}`}
        onSubmit={handleSubmit}
      >
        <div className="admin-voucher-section">
          <span className="admin-voucher-section__title">Mã &amp; loại giảm</span>
          <div className="admin-form__row">
            <label>
              Mã voucher
              <input
                required
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="VD: SALE10"
                autoComplete="off"
              />
            </label>
            <label>
              Loại giảm
              <select
                value={form.discount_type}
                onChange={(e) => setForm((f) => ({ ...f, discount_type: e.target.value }))}
              >
                <option value="percent">Phần trăm (%)</option>
                <option value="fixed">Số tiền cố định (đ)</option>
              </select>
            </label>
          </div>
          <div className="admin-form__row">
            <label>
              {isPercent ? "Giá trị giảm (%)" : "Giá trị giảm (đ)"}
              <input
                required
                type="number"
                min="0"
                step={isPercent ? "0.01" : "1"}
                value={form.discount_value}
                onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))}
              />
            </label>
            {isPercent ? (
              <label>
                Giảm tối đa (đ) — tuỳ chọn
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.max_discount_amount}
                  onChange={(e) => setForm((f) => ({ ...f, max_discount_amount: e.target.value }))}
                  placeholder="Không giới hạn trần"
                />
              </label>
            ) : (
              <div className="admin-voucher-placeholder" aria-hidden />
            )}
          </div>
        </div>

        <div className="admin-voucher-section">
          <span className="admin-voucher-section__title">Giới hạn sử dụng</span>
          <div className="admin-form__row">
            <label>
              Tổng lượt dùng tối đa
              <input
                type="number"
                min="0"
                value={form.usage_limit}
                onChange={(e) => setForm((f) => ({ ...f, usage_limit: e.target.value }))}
                placeholder="Để trống = không giới hạn"
              />
            </label>
            <label>
              Mỗi khách tối đa
              <input
                type="number"
                min="0"
                value={form.per_user_limit}
                onChange={(e) => setForm((f) => ({ ...f, per_user_limit: e.target.value }))}
                placeholder="Để trống = không giới hạn"
              />
            </label>
          </div>
        </div>

        <div className="admin-voucher-section">
          <span className="admin-voucher-section__title">Điều kiện áp dụng</span>
          <label>
            Đơn tối thiểu (đ)
            <input
              type="number"
              min="0"
              value={form.min_order_value}
              onChange={(e) => setForm((f) => ({ ...f, min_order_value: e.target.value }))}
            />
          </label>
          <div className="admin-form__row">
            <label>
              Bắt đầu
              <input
                required
                type="datetime-local"
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
              />
            </label>
            <label>
              Kết thúc
              <input
                required
                type="datetime-local"
                value={form.end_date}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
              />
            </label>
          </div>
          <div className="admin-voucher-categories">
            <span className="admin-voucher-categories__label">Danh mục áp dụng</span>
            <p className="admin-voucher-categories__hint">Không chọn ô nào = áp dụng mọi danh mục.</p>
            <div className="admin-voucher-categories__scroll">
              {categoryTree.length === 0 ? (
                <p className="admin-page__muted">Đang tải danh mục…</p>
              ) : (
                categoryTree.map((root) => (
                  <div key={root.category_id} className="admin-voucher-cat-group">
                    <div className="admin-voucher-cat-root">{root.category_name}</div>
                    {(root.children || []).map((ch) => {
                      const id = String(ch.category_id);
                      return (
                        <label key={id} className="admin-voucher-cat-item">
                          <input
                            type="checkbox"
                            checked={form.selectedCategoryIds.includes(id)}
                            onChange={() => toggleCategoryId(id)}
                          />
                          <span>{ch.category_name}</span>
                        </label>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="admin-voucher-actions">
          <button type="submit" className="admin-btn" disabled={loading}>
            {editingId ? "Cập nhật voucher" : "Tạo voucher"}
          </button>
          {editingId ? (
            <button type="button" className="admin-btn admin-btn--secondary" onClick={resetForm}>
              Hủy
            </button>
          ) : null}
        </div>
      </form>

      <h2 className="admin-voucher-list-heading">Danh sách voucher</h2>
      {loading ? (
        <p>Đang tải…</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table admin-table--vouchers">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Loại</th>
                <th>Giá trị</th>
                <th>Đã dùng / giới hạn</th>
                <th>Hạn</th>
                <th>TT</th>
                <th className="admin-table__actions">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((v) => {
                const active = String(v.status || "").toLowerCase() === "active";
                const isEditingRow = editingId && String(v.voucher_id) === String(editingId);
                return (
                  <tr
                    key={v.voucher_id}
                    className={isEditingRow ? "admin-table__row--editing" : undefined}
                  >
                    <td>
                      <code className="admin-voucher-code">{v.code}</code>
                    </td>
                    <td>{v.discount_type === "fixed" ? "Cố định" : "%"}</td>
                    <td>{String(v.discount_value)}</td>
                    <td>
                      {v.usage_count ?? 0}
                      {v.usage_limit != null ? ` / ${v.usage_limit}` : ""}
                    </td>
                    <td className="admin-table__muted">
                      {v.start_date?.slice?.(0, 10)} → {v.end_date?.slice?.(0, 10)}
                    </td>
                    <td>
                      <span className={active ? "admin-badge admin-badge--ok" : "admin-badge admin-badge--off"}>
                        {active ? "Hoạt động" : "Tắt"}
                      </span>
                    </td>
                    <td className="admin-table__actions">
                      <button
                        type="button"
                        className="admin-btn admin-btn--sm"
                        onClick={() => startEdit(v)}
                        title="Mở form phía trên để sửa voucher"
                      >
                        Sửa
                      </button>{" "}
                      <button
                        type="button"
                        className="admin-btn admin-btn--sm"
                        onClick={() => copyCode(v.code)}
                        title="Sao chép mã voucher"
                        aria-label={`Copy mã ${v.code}`}
                      >
                        Copy mã
                      </button>{" "}
                      <button
                        type="button"
                        className="admin-btn admin-btn--sm admin-btn--secondary"
                        onClick={() => toggleStatus(v)}
                        title={
                          active
                            ? "Tắt — khách không dùng được mã này"
                            : "Bật — cho phép khách dùng mã (còn trong hạn và lượt)"
                        }
                        aria-pressed={active}
                      >
                        {active ? "Tắt" : "Bật"}
                      </button>{" "}
                      <button
                        type="button"
                        className="admin-btn admin-btn--sm admin-btn--danger"
                        onClick={() => removeVoucher(v.voucher_id)}
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
