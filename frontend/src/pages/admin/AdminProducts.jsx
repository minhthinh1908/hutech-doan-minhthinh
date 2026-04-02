import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost, apiUploadFile } from "../../api/client.js";
import {
  CoreBadge,
  CoreButton,
  CoreCard,
  CoreCheckbox,
  CoreMessage,
  CoreSelect,
  CoreTable,
  CoreTextarea,
} from "../../components/ui/index.js";
import useAdminToastNotices from "../../hooks/useAdminToastNotices.js";

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

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

/** Giá nhập kiểu VN (1.500.000) hoặc số thường — tránh Number("1.500.000") = 1.5 */
function parseMoneyVn(v) {
  const s = String(v ?? "")
    .trim()
    .replace(/\s/g, "");
  if (s === "") return NaN;
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    return Number(s.replace(/\./g, ""));
  }
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

/** Giá bán = giá niêm yết × (1 − %/100) */
function calcPriceFromOldAndPercent(oldStr, pctStr) {
  const old = parseFloat(String(oldStr ?? "").replace(",", "."));
  const pct = parseFloat(String(pctStr ?? "").replace(",", "."));
  if (Number.isNaN(old) || old < 0) return "";
  if (Number.isNaN(pct) || pct < 0) return "";
  if (pct >= 100) return "0";
  return String(roundMoney(old * (1 - pct / 100)));
}

/** % giảm từ giá niêm yết và giá bán (khi sửa tay giá bán) */
function derivePercentFromPrices(oldStr, priceStr) {
  const old = parseFloat(String(oldStr ?? "").replace(",", "."));
  const price = parseFloat(String(priceStr ?? "").replace(",", "."));
  if (Number.isNaN(old) || old <= 0 || Number.isNaN(price) || price < 0) return "";
  let pct = 100 * (1 - price / old);
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  return String(roundMoney(pct));
}

/** Chuẩn hóa link ảnh: thêm https:// nếu thiếu; // → https:; giữ đường dẫn /uploads/… */
function normalizeImageUrlInput(raw) {
  let u = String(raw ?? "").trim();
  if (!u) return "";
  u = u.replace(/^[\s\uFEFF]+|[\s\uFEFF]+$/g, "");
  if (u.startsWith("data:")) return u;
  if (u.startsWith("//")) return `https:${u}`;
  if (u.startsWith("/")) return u;
  if (/^https?:\/\//i.test(u)) return u;
  return `https://${u}`;
}

/**
 * Thêm sản phẩm bắt buộc có SKU — nếu để trống, tự tạo từ tên + hậu tố (tránh lỗi API).
 */
function generateSkuFallback(productName) {
  const raw = String(productName || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const mid = raw || "SP";
  const suf = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
  return `${mid}-${suf}`.replace(/-{2,}/g, "-").slice(0, 80);
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
  const [imageUrlBroken, setImageUrlBroken] = useState(false);
  useAdminToastNotices({ err, msg, setErr, setMsg });
  const mainImageFileRef = useRef(null);

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
    discount_percent: "",
    is_hot: false,
    is_bestseller: false,
    is_new: false,
    contact_only: false,
    is_flash_sale: false,
    flash_sale_price: "",
    flash_sale_start: "",
    flash_sale_end: "",
    is_featured: false
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

  const categoryOptions = useMemo(
    () =>
      categoryTree.map((root) => ({
        label: `${root.category_name} (${(root.children || []).length})`,
        items: (root.children || []).map((ch) => ({
          label: ch.category_name,
          value: String(ch.category_id),
        })),
      })),
    [categoryTree]
  );

  const brandOptions = useMemo(
    () =>
      brands.map((b) => ({
        label: b.brand_name,
        value: String(b.brand_id),
      })),
    [brands]
  );

  const statusOptions = useMemo(
    () => [
      { label: "active", value: "active" },
      { label: "inactive", value: "inactive" },
    ],
    []
  );

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
        if (!cancelled) setErr(e.message || "Không tải được dữ liệu.");
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
      discount_percent: (() => {
        const o = p.old_price != null && p.old_price !== "" ? String(p.old_price) : "";
        const pr = p.price != null ? String(p.price) : "";
        return o && pr ? derivePercentFromPrices(o, pr) : "";
      })(),
      is_hot: Boolean(p.is_hot),
      is_bestseller: Boolean(p.is_bestseller),
      is_new: Boolean(p.is_new),
      contact_only: Boolean(p.contact_only),
      is_flash_sale: Boolean(p.is_flash_sale),
      flash_sale_price:
        p.flash_sale_price != null && p.flash_sale_price !== "" ? String(p.flash_sale_price) : "",
      flash_sale_start: isoToDatetimeLocal(p.flash_sale_start),
      flash_sale_end: isoToDatetimeLocal(p.flash_sale_end),
      is_featured: Boolean(p.is_featured)
    });
    setMsg("");
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function setOldPriceForDiscount(v) {
    setForm((f) => {
      const next = { ...f, old_price: v };
      if (String(v).trim() !== "" && String(f.discount_percent).trim() !== "") {
        next.price = calcPriceFromOldAndPercent(v, f.discount_percent);
      }
      return next;
    });
  }

  function setDiscountPercent(v) {
    setForm((f) => {
      const next = { ...f, discount_percent: v };
      if (String(f.old_price).trim() !== "") {
        next.price = calcPriceFromOldAndPercent(f.old_price, v);
      }
      return next;
    });
  }

  function setPriceManual(v) {
    setForm((f) => {
      const next = { ...f, price: v };
      if (String(f.old_price).trim() !== "" && String(v).trim() !== "") {
        next.discount_percent = derivePercentFromPrices(f.old_price, v);
      }
      return next;
    });
  }

  async function handleImageFile(file, field) {
    if (!localStorage.getItem("bd_access_token")) {
      setErr("Cần đăng nhập tài khoản Admin mới tải ảnh lên được.");
      return;
    }
    setUploadingField(field);
    setErr("");
    try {
      const data = await apiUploadFile("/admin/upload-image", file);
      if (data?.url) {
        setForm((f) => ({ ...f, [field]: data.url }));
        setImageUrlBroken(false);
      }
      setMsg("Đã tải ảnh lên — nhấn Lưu/Cập nhật để ghi vào sản phẩm.");
    } catch (e) {
      setErr(e.message || "Không tải được ảnh.");
    } finally {
      setUploadingField(null);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    const priceNum = parseMoneyVn(form.price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setErr("Giá bán không hợp lệ — nhập số (có thể dùng dạng 1.500.000).");
      return;
    }
    let oldPriceNum = null;
    if (form.old_price.trim()) {
      oldPriceNum = parseMoneyVn(form.old_price);
      if (!Number.isFinite(oldPriceNum) || oldPriceNum < 0) {
        setErr("Giá niêm yết không hợp lệ.");
        return;
      }
    }

    let skuOut = form.sku.trim();
    if (!editingId) {
      if (!skuOut) {
        skuOut = generateSkuFallback(form.product_name);
      }
      if (!skuOut || skuOut.length < 2) {
        setErr("Cần tên sản phẩm hoặc nhập SKU (mã không trùng).");
        return;
      }
    }

    const payload = {
      category_id: form.category_id,
      brand_id: form.brand_id,
      product_name: form.product_name.trim(),
      sku: editingId ? form.sku.trim() : skuOut,
      price: priceNum,
      stock_quantity: parseInt(form.stock_quantity, 10) || 0,
      warranty_months: parseInt(form.warranty_months, 10) || 0,
      description: form.description.trim() || null,
      image_url: form.image_url.trim() ? normalizeImageUrlInput(form.image_url) : null,
      status: form.status,
      old_price: oldPriceNum,
      is_hot: form.is_hot,
      is_bestseller: form.is_bestseller,
      is_new: form.is_new,
      contact_only: form.contact_only,
      is_flash_sale: form.is_flash_sale,
      flash_sale_price:
        form.is_flash_sale && String(form.flash_sale_price).trim() !== ""
          ? (() => {
              const x = parseMoneyVn(form.flash_sale_price);
              return Number.isFinite(x) ? x : null;
            })()
          : null,
      flash_sale_start:
        form.is_flash_sale && form.flash_sale_start
          ? new Date(form.flash_sale_start).toISOString()
          : null,
      flash_sale_end:
        form.is_flash_sale && form.flash_sale_end ? new Date(form.flash_sale_end).toISOString() : null,
      is_featured: form.is_featured,
      featured_banner_title: null,
      featured_banner_subtitle: null,
      featured_label_1: null,
      featured_label_2: null,
      featured_side_image_url: null
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
      setErr(e.message || "Không lưu được dữ liệu.");
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
      setErr(e.message || "Không xóa được dữ liệu.");
    }
  }

  const sectionTitleClass = "text-sm font-bold uppercase tracking-wide text-[#111111] border-l-4 border-[#FFC107] pl-3";

  const columns = [
      { key: "id", header: "ID", field: "product_id" },
      { key: "name", header: "Tên", field: "product_name" },
      { key: "category", header: "Danh mục", body: (p) => categoryTableLabel(p) },
      { key: "price", header: "Giá", body: (p) => `${money(p.price)}đ` },
      {
        key: "flash",
        header: "Flash",
        body: (p) =>
          p.is_flash_sale ? <CoreBadge value="Có" tone="warn" /> : <CoreBadge value="—" tone="neutral" />,
      },
      {
        key: "featured",
        header: "Nổi bật",
        body: (p) =>
          p.is_featured ? <CoreBadge value="Có" tone="success" /> : <CoreBadge value="—" tone="neutral" />,
      },
      { key: "stock", header: "Tồn", field: "stock_quantity" },
      { key: "image", header: "Ảnh", body: (p) => (p.image_url ? "Có" : "—") },
    ];

  return (
    <div className="admin-page">
      <h1 className="admin-section-title">Sản phẩm</h1>
      <p className="admin-lead">
        Chọn <strong>danh mục con</strong> trong đúng <strong>một trong 6 nhóm</strong> (MÁY MÓC CẦM TAY … DỤNG CỤ ĐO LƯỜNG) — trùng với menu mega / trang chủ. Sản phẩm chỉ gán vào{" "}
        <em>danh mục con</em>, không gán nhóm gốc. Ảnh: dán URL (https://…).
      </p>
      {!loading && categoryTree.length === 0 ? (
        <CoreMessage
          severity="error"
          text={
            "Chưa có cây danh mục. Mở Admin → Danh mục và bấm «Đồng bộ catalog mẫu», rồi tải lại trang này."
          }
        />
      ) : null}
      {!loading && categoryTree.length > 0 && totalLeaves === 0 ? (
        <CoreMessage
          severity="error"
          text={`Có ${categoryTree.length} nhóm gốc nhưng chưa có danh mục con. Vào Admin → Danh mục → «Đồng bộ catalog mẫu».`}
        />
      ) : null}
      {!loading && brands.length === 0 ? (
        <CoreMessage
          severity="warn"
          text="Chưa có thương hiệu — dropdown «Thương hiệu» sẽ trống. Mở Admin → Thương hiệu (API sẽ tự tạo 5 hãng mẫu nếu bảng trống), sau đó tải lại trang này (F5)."
        />
      ) : null}
      <CoreCard>
        <form className="space-y-5" onSubmit={submit}>
          <div className="rounded-xl border border-[#E5E5E5] p-4 sm:p-5 space-y-4">
            <div className={sectionTitleClass}>Thông tin cơ bản</div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <CoreSelect
                label={`Danh mục (nhóm nhỏ trong menu) — ${
                  totalLeaves ? `${totalLeaves} mục trong ${categoryTree.length} nhóm` : "chưa có mục con"
                }`}
                required
                value={form.category_id}
                options={categoryOptions}
                optionGroupLabel="label"
                optionGroupChildren="items"
                placeholder="— Chọn danh mục con (trong 1 trong 6 nhóm) —"
                onChange={(e) => setForm((f) => ({ ...f, category_id: e.value || "" }))}
              />
              <CoreSelect
                label={`Thương hiệu (${brands.length} hãng — cùng danh sách với Admin → Thương hiệu)`}
                required
                value={form.brand_id}
                options={brandOptions}
                placeholder="— Chọn thương hiệu —"
                onChange={(e) => setForm((f) => ({ ...f, brand_id: e.value || "" }))}
              />
              <label className="admin-form-label lg:col-span-2">
                Tên sản phẩm
                <input
                  required
                  className="admin-form-control mt-1"
                  value={form.product_name}
                  onChange={(e) => setForm((f) => ({ ...f, product_name: e.target.value }))}
                />
              </label>
              <label className="admin-form-label">
                SKU {editingId ? "(không đổi)" : "(tùy chọn — để trống sẽ tự tạo)"}
                <input
                  required={!!editingId}
                  disabled={!!editingId}
                  className="admin-form-control mt-1"
                  value={form.sku}
                  onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                  placeholder={editingId ? "" : "VD: DCD709-D1 — hoặc để trống"}
                />
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-[#E5E5E5] p-4 sm:p-5 space-y-4">
            <div className={sectionTitleClass}>Giá và khuyến mãi</div>
            <p className="text-sm text-[#666666] mt-0">
              Nhập <strong>giá niêm yết</strong> và <strong>% giảm</strong> — <strong>giá bán</strong> tự tính. Có thể sửa tay giá
              bán; % sẽ cập nhật theo.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <label className="admin-form-label">
                Giá niêm yết / trước giảm (đ)
                <input
                  type="number"
                  min="0"
                  step="1000"
                  className="admin-form-control mt-1"
                  value={form.old_price}
                  onChange={(e) => setOldPriceForDiscount(e.target.value)}
                  placeholder="VD: 1.500.000"
                />
              </label>
              <label className="admin-form-label">
                Giảm (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  className="admin-form-control mt-1"
                  value={form.discount_percent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                  placeholder="0 – 100"
                />
              </label>
              <label className="admin-form-label">
                Giá bán (đ) — lưu vào hệ thống
                <input
                  required
                  type="number"
                  min="0"
                  step="1000"
                  className="admin-form-control mt-1"
                  value={form.price}
                  onChange={(e) => setPriceManual(e.target.value)}
                />
              </label>
            </div>
            <p className="text-xs text-[#666666] m-0">
              Để 0 giá bán nếu chỉ «Liên hệ». Không nhập giá niêm yết thì chỉ cần điền giá bán.
            </p>
          </div>

          <div className="rounded-xl border border-[#E5E5E5] p-4 sm:p-5 space-y-4">
            <div className={sectionTitleClass}>Hiển thị và tồn kho</div>
            <div className="flex flex-wrap gap-4">
              <CoreCheckbox
                inputId="is_hot"
                checked={form.is_hot}
                onChange={(e) => setForm((f) => ({ ...f, is_hot: Boolean(e.checked) }))}
                label="Hot (thẻ đỏ)"
              />
              <CoreCheckbox
                inputId="is_bestseller"
                checked={form.is_bestseller}
                onChange={(e) => setForm((f) => ({ ...f, is_bestseller: Boolean(e.checked) }))}
                label="Tab «Sản phẩm bán chạy»"
              />
              <CoreCheckbox
                inputId="is_new"
                checked={form.is_new}
                onChange={(e) => setForm((f) => ({ ...f, is_new: Boolean(e.checked) }))}
                label="Tab «Sản phẩm mới»"
              />
              <CoreCheckbox
                inputId="contact_only"
                checked={form.contact_only}
                onChange={(e) => setForm((f) => ({ ...f, contact_only: Boolean(e.checked) }))}
                label="Liên hệ (không hiện giá)"
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <label className="admin-form-label">
                Tồn kho
                <input
                  type="number"
                  min="0"
                  className="admin-form-control mt-1"
                  value={form.stock_quantity}
                  onChange={(e) => setForm((f) => ({ ...f, stock_quantity: e.target.value }))}
                />
              </label>
              <label className="admin-form-label">
                Bảo hành (tháng)
                <input
                  type="number"
                  min="0"
                  className="admin-form-control mt-1"
                  value={form.warranty_months}
                  onChange={(e) => setForm((f) => ({ ...f, warranty_months: e.target.value }))}
                />
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-[#E5E5E5] p-4 sm:p-5 space-y-4">
            <div className={sectionTitleClass}>Flash sale và sản phẩm nổi bật</div>
            <CoreCheckbox
              inputId="is_flash_sale"
              checked={form.is_flash_sale}
              onChange={(e) => setForm((f) => ({ ...f, is_flash_sale: Boolean(e.checked) }))}
              label="Tham gia Flash sale"
            />
            {form.is_flash_sale ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <label className="admin-form-label">
                  Giá flash (đ)
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    className="admin-form-control mt-1"
                    value={form.flash_sale_price}
                    onChange={(e) => setForm((f) => ({ ...f, flash_sale_price: e.target.value }))}
                    placeholder="Thấp hơn giá bán thường"
                  />
                </label>
                <label className="admin-form-label">
                  Bắt đầu
                  <input
                    type="datetime-local"
                    className="admin-form-control mt-1"
                    value={form.flash_sale_start}
                    onChange={(e) => setForm((f) => ({ ...f, flash_sale_start: e.target.value }))}
                  />
                </label>
                <label className="admin-form-label">
                  Kết thúc
                  <input
                    type="datetime-local"
                    className="admin-form-control mt-1"
                    value={form.flash_sale_end}
                    onChange={(e) => setForm((f) => ({ ...f, flash_sale_end: e.target.value }))}
                  />
                </label>
              </div>
            ) : null}
            <p className="text-xs text-[#666666] m-0">
              Để trống thời gian = không giới hạn phía đó. Sản phẩm hiện ở thanh Flash sale khi trong khung giờ và có giá flash.
            </p>
            <CoreCheckbox
              inputId="is_featured"
              checked={form.is_featured}
              onChange={(e) => setForm((f) => ({ ...f, is_featured: Boolean(e.checked) }))}
              label="Hiển thị ở mục «Sản phẩm nổi bật» (trang chủ)"
            />
            <p className="text-xs text-[#666666] m-0">
              Trên trang chủ, khối này tự lấy <strong>tên thương hiệu</strong>, <strong>SKU</strong> và <strong>ảnh sản phẩm</strong>.
            </p>
          </div>

          <div className="rounded-xl border border-[#E5E5E5] p-4 sm:p-5 space-y-4">
            <div className={sectionTitleClass}>Ảnh và mô tả</div>
            <label className="admin-form-label block">
              URL ảnh (dán link hoặc chọn tệp — lưu máy chủ: /uploads/…)
              <p className="text-xs text-[#666666] mt-1 mb-2">
                Dán <strong>link trực tiếp tới file ảnh</strong> (thường kết thúc bằng .jpg / .png). Nếu ảnh lỗi, hãy dùng nút «Chọn tệp».
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  className="admin-form-control"
                  placeholder="https://… hoặc /uploads/…"
                  value={form.image_url}
                  onChange={(e) => {
                    setImageUrlBroken(false);
                    setForm((f) => ({ ...f, image_url: e.target.value }));
                  }}
                  onBlur={(e) => {
                    const n = normalizeImageUrlInput(e.target.value);
                    if (n !== e.target.value) setForm((f) => ({ ...f, image_url: n }));
                  }}
                  disabled={uploadingField === "image_url"}
                />
                <input
                  ref={mainImageFileRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp"
                  className="hidden"
                  tabIndex={-1}
                  disabled={uploadingField === "image_url"}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void handleImageFile(f, "image_url");
                  }}
                />
                <CoreButton
                  type="button"
                  label={uploadingField === "image_url" ? "Đang tải…" : "Chọn tệp"}
                  tone="secondary"
                  disabled={uploadingField === "image_url"}
                  onClick={() => mainImageFileRef.current?.click()}
                />
              </div>
              {form.image_url.trim() ? (
                <div className="mt-3 rounded-lg border border-[#E5E5E5] bg-[#F5F5F5] p-3">
                  <p className="text-xs text-[#666666] m-0 mb-2">Xem thử:</p>
                  <img
                    src={normalizeImageUrlInput(form.image_url)}
                    alt=""
                    className="h-28 w-28 rounded border border-[#E5E5E5] object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onLoad={() => setImageUrlBroken(false)}
                    onError={() => setImageUrlBroken(true)}
                  />
                  {imageUrlBroken ? (
                    <CoreMessage
                      severity="warn"
                      className="mt-3"
                      text="Không tải được ảnh từ link này. Hãy dùng link ảnh trực tiếp hoặc nút Chọn tệp."
                    />
                  ) : null}
                </div>
              ) : null}
            </label>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <CoreTextarea
                label="Mô tả"
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
              <CoreSelect
                label="Trạng thái"
                value={form.status}
                options={statusOptions}
                onChange={(e) => setForm((f) => ({ ...f, status: e.value }))}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CoreButton
              type="submit"
              label={editingId ? "Cập nhật sản phẩm" : "Thêm sản phẩm"}
              tone="primary"
            />
            {editingId ? (
              <CoreButton
                type="button"
                label="Hủy sửa"
                tone="secondary"
                onClick={cancelEdit}
              />
            ) : null}
          </div>
        </form>
      </CoreCard>

      {loading ? (
        <p>Đang tải dữ liệu…</p>
      ) : (
        <CoreCard>
          <CoreTable
            value={items}
            columns={columns}
            dataKey="product_id"
            rows={10}
            actionConfig={{
              onEdit: (row) => startEdit(row),
              onDelete: (row) => remove(row.product_id),
              copyFields: [
                { label: "Mã sản phẩm", field: "product_id" },
                { label: "Tên sản phẩm", field: "product_name" },
                { label: "SKU", field: "sku" },
              ],
              excel: { fileName: "admin-products.xlsx" },
            }}
          />
        </CoreCard>
      )}
    </div>
  );
}
