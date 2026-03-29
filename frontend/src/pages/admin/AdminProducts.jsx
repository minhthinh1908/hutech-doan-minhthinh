import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiDelete, apiGet, apiPatch, apiPost } from "../../api/client.js";
import "./AdminPages.css";

function money(n) {
  return Number(n || 0).toLocaleString("vi-VN");
}

function isoToDatetimeLocal(v) {
  if (v == null || v === "") return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminProducts() {
  const [items, setItems] = useState([]);
  const [categoryTree, setCategoryTree] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [uploadingField, setUploadingField] = useState(null);
  const mainImageFileRef = useRef(null);
  const featuredSideImageFileRef = useRef(null);

  const emptyForm = {
    category_id: "",
    brand_id: "",
    product_name: "",
    sku: "",
    price: "",
    stock_quantity: "0",
    warranty_months: "0",
    description: "",
    image_url: "",
    status: "active",
    old_price: "",
    is_hot: false,
    is_bestseller: false,
    is_new: false,
    contact_only: false,
    is_flash_sale: false,
    flash_sale_price: "",
    flash_sale_start: "",
    flash_sale_end: "",
    is_featured: false,
    featured_banner_title: "",
    featured_banner_subtitle: "",
    featured_label_1: "",
    featured_label_2: "",
    featured_side_image_url: ""
  };
  const [form, setForm] = useState(emptyForm);

  const loadMeta = useCallback(async () => {
    const [tree, b] = await Promise.all([apiGet("/categories/tree"), apiGet("/brands")]);
    setCategoryTree(Array.isArray(tree) ? tree : []);
    setBrands(Array.isArray(b) ? b : []);
  }, []);

  /** ID các danh mục con (lá) — sản phẩm chỉ gán vào lá, khớp menu mega 5 cột */
  const leafIds = useMemo(() => {
    const ids = [];
    categoryTree.forEach((root) => {
      (root.children || []).forEach((ch) => ids.push(String(ch.category_id)));
    });
    return ids;
  }, [categoryTree]);

  const totalLeaves = leafIds.length;

  function categoryTableLabel(p) {
    const c = p.category;
    if (!c) return "—";
    if (c.parent) return `${c.parent.category_name} › ${c.category_name}`;
    return c.category_name;
  }

  const loadProducts = useCallback(async () => {
    setErr("");
    const data = await apiGet("/products", { limit: 200 });
    setItems(data.items || []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await loadMeta();
        await loadProducts();
      } catch (e) {
        if (!cancelled) setErr(e.message || "Lỗi tải");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadMeta, loadProducts]);

  function startEdit(p) {
    setEditingId(p.product_id);
    setForm({
      category_id: String(p.category_id),
      brand_id: String(p.brand_id),
      product_name: p.product_name || "",
      sku: p.sku || "",
      price: String(p.price ?? ""),
      stock_quantity: String(p.stock_quantity ?? 0),
      warranty_months: String(p.warranty_months ?? 0),
      description: p.description || "",
      image_url: p.image_url || "",
      status: p.status || "active",
      old_price: p.old_price != null && p.old_price !== "" ? String(p.old_price) : "",
      is_hot: Boolean(p.is_hot),
      is_bestseller: Boolean(p.is_bestseller),
      is_new: Boolean(p.is_new),
      contact_only: Boolean(p.contact_only),
      is_flash_sale: Boolean(p.is_flash_sale),
      flash_sale_price:
        p.flash_sale_price != null && p.flash_sale_price !== "" ? String(p.flash_sale_price) : "",
      flash_sale_start: isoToDatetimeLocal(p.flash_sale_start),
      flash_sale_end: isoToDatetimeLocal(p.flash_sale_end),
      is_featured: Boolean(p.is_featured),
      featured_banner_title: p.featured_banner_title || "",
      featured_banner_subtitle: p.featured_banner_subtitle || "",
      featured_label_1: p.featured_label_1 || "",
      featured_label_2: p.featured_label_2 || "",
      featured_side_image_url: p.featured_side_image_url || ""
    });
    setMsg("");
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleImageFile(file, field) {
    setUploadingField(field);
    setErr("");
    try {
      const data = await apiUploadFile("/admin/upload-image", file);
      if (data?.url) setForm((f) => ({ ...f, [field]: data.url }));
      setMsg("Đã tải ảnh lên — nhấn Lưu/Cập nhật để ghi vào sản phẩm.");
    } catch (e) {
      setErr(e.message || "Tải ảnh thất bại");
    } finally {
      setUploadingField(null);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    const payload = {
      category_id: form.category_id,
      brand_id: form.brand_id,
      product_name: form.product_name.trim(),
      sku: form.sku.trim(),
      price: Number(form.price),
      stock_quantity: parseInt(form.stock_quantity, 10) || 0,
      warranty_months: parseInt(form.warranty_months, 10) || 0,
      description: form.description.trim() || null,
      image_url: form.image_url.trim() || null,
      status: form.status,
      old_price: form.old_price.trim() ? Number(form.old_price) : null,
      is_hot: form.is_hot,
      is_bestseller: form.is_bestseller,
      is_new: form.is_new,
      contact_only: form.contact_only,
      is_flash_sale: form.is_flash_sale,
      flash_sale_price:
        form.is_flash_sale && String(form.flash_sale_price).trim() !== ""
          ? Number(form.flash_sale_price)
          : null,
      flash_sale_start:
        form.is_flash_sale && form.flash_sale_start
          ? new Date(form.flash_sale_start).toISOString()
          : null,
      flash_sale_end:
        form.is_flash_sale && form.flash_sale_end ? new Date(form.flash_sale_end).toISOString() : null,
      is_featured: form.is_featured,
      featured_banner_title: form.is_featured ? form.featured_banner_title.trim() || null : null,
      featured_banner_subtitle: form.is_featured ? form.featured_banner_subtitle.trim() || null : null,
      featured_label_1: form.is_featured ? form.featured_label_1.trim() || null : null,
      featured_label_2: form.is_featured ? form.featured_label_2.trim() || null : null,
      featured_side_image_url: form.is_featured ? form.featured_side_image_url.trim() || null : null
    };
    try {
      if (editingId) {
        await apiPatch(`/products/${editingId}`, payload);
        setMsg("Đã cập nhật sản phẩm.");
      } else {
        await apiPost("/products", payload, { auth: true });
        setMsg("Đã thêm sản phẩm — hiển thị đúng danh mục trên trang Sản phẩm.");
        setForm(emptyForm);
      }
      await loadProducts();
      if (editingId) cancelEdit();
    } catch (e) {
      setErr(e.message || "Thất bại");
    }
  }

  async function remove(id) {
    if (!window.confirm("Xóa sản phẩm này?")) return;
    setErr("");
    try {
      await apiDelete(`/products/${id}`);
      setMsg("Đã xóa.");
      await loadProducts();
    } catch (e) {
      setErr(e.message || "Không xóa được");
    }
  }

  return (
    <div className="admin-page">
      <h1>Sản phẩm</h1>
      <p className="admin-page__muted">
        Chọn <strong>danh mục con</strong> trong đúng <strong>một trong 6 nhóm</strong> (MÁY MÓC CẦM TAY … DỤNG CỤ ĐO LƯỜNG) — trùng với menu mega / trang chủ. Sản phẩm chỉ gán vào{" "}
        <em>danh mục con</em>, không gán nhóm gốc. Ảnh: dán URL (https://…).
      </p>
      {!loading && categoryTree.length === 0 ? (
        <p className="admin-msg admin-msg--err" role="alert">
          Chưa có cây danh mục. Mở{" "}
          <Link to="/admin/danh-muc" style={{ fontWeight: 700 }}>
            Admin → Danh mục
          </Link>{" "}
          và bấm «Đồng bộ catalog mẫu», rồi tải lại trang này.
        </p>
      ) : null}
      {!loading && categoryTree.length > 0 && totalLeaves === 0 ? (
        <p className="admin-msg admin-msg--err" role="alert">
          Có {categoryTree.length} nhóm gốc nhưng <strong>chưa có danh mục con</strong>. Vào{" "}
          <Link to="/admin/danh-muc" style={{ fontWeight: 700 }}>
            Danh mục
          </Link>{" "}
          → «Đồng bộ catalog mẫu» để thêm đầy đủ mục con giống menu khách.
        </p>
      ) : null}
      {!loading && brands.length === 0 ? (
        <p className="admin-msg admin-msg--err" role="alert">
          Chưa có thương hiệu — dropdown «Thương hiệu» sẽ trống. Mở{" "}
          <Link to="/admin/thuong-hieu" style={{ fontWeight: 700 }}>
            Admin → Thương hiệu
          </Link>{" "}
          (API sẽ tự tạo 5 hãng mẫu nếu bảng trống), sau đó <strong>tải lại trang này (F5)</strong>.
        </p>
      ) : null}
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

      <form className="admin-form admin-form--wide" onSubmit={submit}>
        <div className="admin-form__row">
          <label>
            Danh mục (nhóm nhỏ trong menu) — {totalLeaves ? `${totalLeaves} mục trong ${categoryTree.length} nhóm` : "chưa có mục con"}
            <select
              required
              className="admin-select--categories"
              value={form.category_id}
              onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
            >
              <option value="">— Chọn danh mục con (trong 1 trong 6 nhóm) —</option>
              {categoryTree.map((root) => {
                const kids = root.children || [];
                const label =
                  kids.length > 0
                    ? `${root.category_name} (${kids.length})`
                    : `${root.category_name} — chưa có danh mục con`;
                return (
                  <optgroup key={root.category_id} label={label}>
                    {kids.length > 0 ? (
                      kids.map((ch) => (
                        <option key={ch.category_id} value={String(ch.category_id)}>
                          {ch.category_name}
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>
                        (Thêm danh mục con trong Admin → Danh mục)
                      </option>
                    )}
                  </optgroup>
                );
              })}
              {form.category_id && !leafIds.includes(String(form.category_id)) ? (
                <option value={form.category_id}>
                  Đang gán #{form.category_id} — không còn trong danh sách, chọn lại
                </option>
              ) : null}
            </select>
          </label>
          <label>
            Thương hiệu ({brands.length} hãng — cùng danh sách với Admin → Thương hiệu)
            <select
              required
              value={form.brand_id}
              onChange={(e) => setForm((f) => ({ ...f, brand_id: e.target.value }))}
            >
              <option value="">— Chọn thương hiệu —</option>
              {brands.map((b) => (
                <option key={b.brand_id} value={String(b.brand_id)}>
                  {b.brand_name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Tên sản phẩm
          <input
            required
            value={form.product_name}
            onChange={(e) => setForm((f) => ({ ...f, product_name: e.target.value }))}
          />
        </label>
        <div className="admin-form__row">
          <label>
            SKU
            <input
              required
              disabled={!!editingId}
              value={form.sku}
              onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
            />
          </label>
          <label>
            Giá (đ) — để 0 nếu chỉ «Liên hệ»
            <input
              required
              type="number"
              min="0"
              step="1000"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            />
          </label>
        </div>
        <div className="admin-form__row">
          <label>
            Giá gốc (gạch ngang, tuỳ chọn)
            <input
              type="number"
              min="0"
              step="1000"
              value={form.old_price}
              onChange={(e) => setForm((f) => ({ ...f, old_price: e.target.value }))}
            />
          </label>
        </div>
        <div className="admin-form__row" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <input
              type="checkbox"
              checked={form.is_hot}
              onChange={(e) => setForm((f) => ({ ...f, is_hot: e.target.checked }))}
            />
            Hot (thẻ đỏ)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <input
              type="checkbox"
              checked={form.is_bestseller}
              onChange={(e) => setForm((f) => ({ ...f, is_bestseller: e.target.checked }))}
            />
            Tab «Sản phẩm bán chạy» (trang chủ)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <input
              type="checkbox"
              checked={form.is_new}
              onChange={(e) => setForm((f) => ({ ...f, is_new: e.target.checked }))}
            />
            Tab «Sản phẩm mới» (trang chủ)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <input
              type="checkbox"
              checked={form.contact_only}
              onChange={(e) => setForm((f) => ({ ...f, contact_only: e.target.checked }))}
            />
            Liên hệ (không hiện giá)
          </label>
        </div>

        <div
          className="admin-form__fieldset"
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: "0.75rem 1rem",
            marginTop: "0.5rem"
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>Flash sale (trang chủ + giá áp dụng)</div>
          <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.5rem" }}>
            <input
              type="checkbox"
              checked={form.is_flash_sale}
              onChange={(e) => setForm((f) => ({ ...f, is_flash_sale: e.target.checked }))}
            />
            Tham gia Flash sale
          </label>
          {form.is_flash_sale ? (
            <div className="admin-form__row" style={{ flexWrap: "wrap" }}>
              <label>
                Giá flash (đ)
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={form.flash_sale_price}
                  onChange={(e) => setForm((f) => ({ ...f, flash_sale_price: e.target.value }))}
                  placeholder="Thấp hơn giá bán thường"
                />
              </label>
              <label>
                Bắt đầu
                <input
                  type="datetime-local"
                  value={form.flash_sale_start}
                  onChange={(e) => setForm((f) => ({ ...f, flash_sale_start: e.target.value }))}
                />
              </label>
              <label>
                Kết thúc
                <input
                  type="datetime-local"
                  value={form.flash_sale_end}
                  onChange={(e) => setForm((f) => ({ ...f, flash_sale_end: e.target.value }))}
                />
              </label>
            </div>
          ) : null}
          <p className="admin-page__muted" style={{ margin: "0.35rem 0 0", fontSize: "0.8rem" }}>
            Để trống thời gian = không giới hạn phía đó. Sản phẩm hiện ở thanh Flash sale khi trong khung giờ và có giá flash.
          </p>
        </div>

        <div
          className="admin-form__fieldset"
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: "0.75rem 1rem",
            marginTop: "0.75rem"
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>Nổi bật (khối banner trên trang chủ)</div>
          <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.5rem" }}>
            <input
              type="checkbox"
              checked={form.is_featured}
              onChange={(e) => setForm((f) => ({ ...f, is_featured: e.target.checked }))}
            />
            Hiển thị ở mục «Sản phẩm nổi bật» (layout banner vàng + ảnh + nhãn)
          </label>
          {form.is_featured ? (
            <>
              <div className="admin-form__row" style={{ flexWrap: "wrap" }}>
                <label>
                  Tiêu đề banner (vd. tên hãng)
                  <input
                    value={form.featured_banner_title}
                    onChange={(e) => setForm((f) => ({ ...f, featured_banner_title: e.target.value }))}
                    placeholder="DEWALT"
                  />
                </label>
                <label>
                  Dòng phụ (vd. khuyến mãi)
                  <input
                    value={form.featured_banner_subtitle}
                    onChange={(e) => setForm((f) => ({ ...f, featured_banner_subtitle: e.target.value }))}
                    placeholder="ACTIVE PROMOTIONS"
                  />
                </label>
              </div>
              <div className="admin-form__row" style={{ flexWrap: "wrap" }}>
                <label>
                  Nhãn 1 (vd. mã model)
                  <input
                    value={form.featured_label_1}
                    onChange={(e) => setForm((f) => ({ ...f, featured_label_1: e.target.value }))}
                    placeholder="DCD801"
                  />
                </label>
                <label>
                  Nhãn 2
                  <input
                    value={form.featured_label_2}
                    onChange={(e) => setForm((f) => ({ ...f, featured_label_2: e.target.value }))}
                    placeholder="DCD806"
                  />
                </label>
              </div>
              <label>
                URL ảnh cột trái (tuỳ chọn — mặc định dùng ảnh sản phẩm)
                <div className="admin-image-field">
                  <input
                    type="url"
                    placeholder="https:// hoặc /uploads/…"
                    value={form.featured_side_image_url}
                    onChange={(e) => setForm((f) => ({ ...f, featured_side_image_url: e.target.value }))}
                    disabled={uploadingField === "featured_side_image_url"}
                  />
                  <input
                    ref={featuredSideImageFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="admin-sr-only"
                    tabIndex={-1}
                    disabled={uploadingField === "featured_side_image_url"}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) void handleImageFile(f, "featured_side_image_url");
                    }}
                  />
                  <button
                    type="button"
                    className="admin-btn admin-btn--secondary admin-btn--file"
                    disabled={uploadingField === "featured_side_image_url"}
                    onClick={() => featuredSideImageFileRef.current?.click()}
                  >
                    {uploadingField === "featured_side_image_url" ? "Đang tải…" : "Chọn tệp"}
                  </button>
                </div>
              </label>
            </>
          ) : null}
        </div>

        <div className="admin-form__row">
          <label>
            Tồn kho
            <input
              type="number"
              min="0"
              value={form.stock_quantity}
              onChange={(e) => setForm((f) => ({ ...f, stock_quantity: e.target.value }))}
            />
          </label>
          <label>
            Bảo hành (tháng)
            <input
              type="number"
              min="0"
              value={form.warranty_months}
              onChange={(e) => setForm((f) => ({ ...f, warranty_months: e.target.value }))}
            />
          </label>
        </div>
        <label>
          URL ảnh (https://… hoặc chọn tệp — lưu vào máy chủ dạng /uploads/…)
          <div className="admin-image-field">
            <input
              type="url"
              placeholder="https:// hoặc /uploads/…"
              value={form.image_url}
              onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
              disabled={uploadingField === "image_url"}
            />
            <input
              ref={mainImageFileRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="admin-sr-only"
              tabIndex={-1}
              disabled={uploadingField === "image_url"}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void handleImageFile(f, "image_url");
              }}
            />
            <button
              type="button"
              className="admin-btn admin-btn--secondary admin-btn--file"
              disabled={uploadingField === "image_url"}
              onClick={() => mainImageFileRef.current?.click()}
            >
              {uploadingField === "image_url" ? "Đang tải…" : "Chọn tệp"}
            </button>
          </div>
        </label>
        <label>
          Mô tả
          <textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </label>
        <label>
          Trạng thái
          <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
        </label>
        <div>
          <button type="submit" className="admin-btn">
            {editingId ? "Cập nhật" : "Thêm sản phẩm"}
          </button>
          {editingId ? (
            <button type="button" className="admin-btn" style={{ marginLeft: "0.5rem", background: "#666" }} onClick={cancelEdit}>
              Hủy sửa
            </button>
          ) : null}
        </div>
      </form>

      {loading ? (
        <p>Đang tải…</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Tên</th>
                <th>Danh mục</th>
                <th>Giá</th>
                <th>Flash</th>
                <th>Nổi bật</th>
                <th>Tồn</th>
                <th>Ảnh</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.product_id}>
                  <td>{p.product_id}</td>
                  <td>{p.product_name}</td>
                  <td style={{ fontSize: "0.8rem", maxWidth: "14rem" }}>{categoryTableLabel(p)}</td>
                  <td>{money(p.price)}đ</td>
                  <td>{p.is_flash_sale ? "Có" : "—"}</td>
                  <td>{p.is_featured ? "Có" : "—"}</td>
                  <td>{p.stock_quantity}</td>
                  <td>{p.image_url ? <span style={{ wordBreak: "break-all" }}>Có</span> : "—"}</td>
                  <td>
                    <button type="button" className="admin-btn" style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }} onClick={() => startEdit(p)}>
                      Sửa
                    </button>{" "}
                    <button
                      type="button"
                      className="admin-btn admin-btn--danger"
                      style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                      onClick={() => remove(p.product_id)}
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
