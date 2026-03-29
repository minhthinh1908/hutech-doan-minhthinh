import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiDelete, apiGet, apiPatch, apiPost } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import BuyerSidebar from "../components/BuyerSidebar.jsx";
import "./BuyerPages.css";

function money(n) {
  return Number(n || 0).toLocaleString("vi-VN");
}

const PAY_METHODS = [
  { value: "cod", label: "Thanh toán khi nhận hàng (COD)" },
  { value: "bank_transfer", label: "Chuyển khoản ngân hàng" },
  { value: "payment_gateway", label: "Cổng thanh toán trực tuyến" }
];

export default function CartPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [voucherCode, setVoucherCode] = useState("");
  const [checkoutErr, setCheckoutErr] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewErr, setPreviewErr] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [shippingAddress, setShippingAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cod");

  useEffect(() => {
    if (user?.address && String(user.address).trim()) {
      setShippingAddress((prev) => (prev.trim() ? prev : String(user.address)));
    }
  }, [user]);

  const load = useCallback(async () => {
    setErr("");
    try {
      const data = await apiGet("/cart");
      setItems(data.items || []);
    } catch (e) {
      setErr(e.message || "Không tải được giỏ hàng.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setQty(cartItemId, quantity) {
    const line = items.find((x) => String(x.cart_item_id) === String(cartItemId));
    const p = line?.product;
    const inactive = p && p.status !== "active";
    const q = Math.max(1, quantity);
    if (inactive && q > (line?.quantity ?? 0)) {
      setErr("Không thể tăng số lượng sản phẩm đã ngừng kinh doanh — chỉ có thể giảm hoặc xóa.");
      return;
    }
    setErr("");
    try {
      await apiPatch(`/cart/items/${cartItemId}`, { quantity: q });
      window.dispatchEvent(new Event("bd-cart-updated"));
      await load();
    } catch (e) {
      setErr(e.message || "Không cập nhật được.");
    }
  }

  async function removeLine(cartItemId) {
    try {
      await apiDelete(`/cart/items/${cartItemId}`);
      window.dispatchEvent(new Event("bd-cart-updated"));
      await load();
    } catch (e) {
      setErr(e.message || "Không xóa được.");
    }
  }

  async function previewVoucher() {
    setPreviewErr("");
    setPreview(null);
    const code = voucherCode.trim();
    if (!code) {
      setPreviewErr("Nhập mã voucher.");
      return;
    }
    setPreviewing(true);
    try {
      const data = await apiPost("/vouchers/preview", { voucher_code: code }, { auth: true });
      setPreview(data);
    } catch (e) {
      setPreviewErr(e.message || "Không áp dụng được mã.");
    } finally {
      setPreviewing(false);
    }
  }

  async function checkout() {
    setCheckoutErr("");
    if (items.some((i) => i.product && i.product.status !== "active")) {
      setCheckoutErr(
        "Giỏ hàng có sản phẩm đã ngừng kinh doanh — vui lòng xóa các dòng đó (hoặc giảm số lượng) rồi đặt hàng lại."
      );
      return;
    }
    const addr = shippingAddress.trim();
    if (!addr) {
      setCheckoutErr("Vui lòng nhập địa chỉ giao hàng.");
      return;
    }
    setCheckingOut(true);
    try {
      const body = { shipping_address: addr, payment_method: paymentMethod };
      if (voucherCode.trim()) body.voucher_code = voucherCode.trim();
      const order = await apiPost("/orders", body, { auth: true });
      window.dispatchEvent(new Event("bd-cart-updated"));
      if (paymentMethod === "payment_gateway" && order.payment_gateway?.redirect_path) {
        navigate(order.payment_gateway.redirect_path);
        return;
      }
      navigate(`/don-hang/${order.order_id}`);
    } catch (e) {
      setCheckoutErr(e.message || "Đặt hàng thất bại.");
    } finally {
      setCheckingOut(false);
    }
  }

  const hasInactiveLine = items.some((i) => i.product && i.product.status !== "active");
  const subtotal = items.reduce((s, i) => s + Number(i.unit_price) * i.quantity, 0);

  return (
    <div className="buyer-page">
      <div className="buyer-page__hero">
        <div className="container">
          <h1 className="buyer-page__title">Giỏ hàng</h1>
          <p className="buyer-page__sub">
            Thêm / sửa số lượng / xóa dòng. Sản phẩm, danh mục, thương hiệu lấy từ Admin — nếu admin tắt sản phẩm, không thể
            thêm mới; dòng cũ trong giỏ cần xóa hoặc giảm trước khi đặt hàng. Mã voucher: dùng «Áp dụng / xem trước» để kiểm
            tra giảm giá.
          </p>
        </div>
      </div>
      <div className="container buyer-shell">
        <BuyerSidebar />
        <div className="buyer-panel">
          {loading ? <p>Đang tải…</p> : null}
          {err ? (
            <p className="buyer-msg buyer-msg--err" role="alert">
              {err}
            </p>
          ) : null}
          {!loading && items.length === 0 ? (
            <p>
              Giỏ hàng trống. <Link to="/san-pham">Xem sản phẩm</Link>
            </p>
          ) : null}
          {items.map((line) => {
            const p = line.product;
            const name = p?.product_name || "Sản phẩm";
            const img = p?.image_url || p?.thumbnail_url || null;
            const inactive = p && p.status !== "active";
            const catBrand = [p?.category?.category_name, p?.brand?.brand_name].filter(Boolean).join(" · ");
            return (
              <div
                key={line.cart_item_id}
                className={`buyer-cart-row${inactive ? " buyer-cart-row--inactive" : ""}`}
              >
                {img ? (
                  <img className="buyer-cart-thumb" src={img} alt="" />
                ) : (
                  <div className="buyer-cart-thumb" />
                )}
                <div>
                  <Link to={`/san-pham/${line.product_id}`}>
                    <strong>{name}</strong>
                  </Link>
                  {catBrand ? (
                    <div className="buyer-muted" style={{ fontSize: "0.82rem" }}>
                      {catBrand}
                    </div>
                  ) : null}
                  <div className="buyer-muted">{money(line.unit_price)}đ / sản phẩm</div>
                  {inactive ? (
                    <p className="buyer-cart-inactive-msg" role="status">
                      Ngừng kinh doanh — không thể tăng số lượng; vui lòng giảm hoặc xóa.
                    </p>
                  ) : null}
                </div>
                <div className="buyer-qty">
                  <button type="button" aria-label="Giảm" onClick={() => setQty(line.cart_item_id, line.quantity - 1)}>
                    −
                  </button>
                  <span>{line.quantity}</span>
                  <button
                    type="button"
                    aria-label="Tăng"
                    disabled={inactive}
                    onClick={() => setQty(line.cart_item_id, line.quantity + 1)}
                  >
                    +
                  </button>
                </div>
                <div>
                  <strong>{money(Number(line.unit_price) * line.quantity)}đ</strong>
                  <div>
                    <button type="button" className="buyer-btn buyer-btn--danger" onClick={() => removeLine(line.cart_item_id)}>
                      Xóa
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {items.length > 0 ? (
            <div className="buyer-checkout">
              <div className="buyer-checkout__row">
                <span>Tạm tính</span>
                <strong>{money(subtotal)}đ</strong>
              </div>
              <p className="buyer-voucher-flow-hint">
                Hệ thống kiểm tra mã (hiệu lực, lượt dùng) → điều kiện giỏ (tối thiểu, danh mục) → tính giảm theo % hoặc
                số tiền cố định → hiển thị tổng thanh toán.
              </p>
              <label className="buyer-form__field" style={{ maxWidth: 400 }}>
                <span className="buyer-form__label">Mã giảm giá (tùy chọn)</span>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                  <input
                    className="buyer-form__input"
                    style={{ flex: 1, minWidth: 140 }}
                    value={voucherCode}
                    onChange={(e) => {
                      setVoucherCode(e.target.value);
                      setPreview(null);
                      setPreviewErr("");
                    }}
                    placeholder="Nhập mã voucher"
                  />
                  <button type="button" className="buyer-btn buyer-btn--primary" disabled={previewing} onClick={previewVoucher}>
                    {previewing ? "Đang kiểm tra…" : "Áp dụng / xem trước"}
                  </button>
                </div>
              </label>
              {previewErr ? (
                <p className="buyer-msg buyer-msg--err" role="alert">
                  {previewErr}
                </p>
              ) : null}
              {preview ? (
                <div className="buyer-voucher-result buyer-voucher-result--ok" role="status">
                  <div className="buyer-voucher-result__title">Áp dụng voucher thành công!</div>
                  <ul className="buyer-voucher-result__lines">
                    <li>
                      <span>Tạm tính giỏ hàng</span>
                      <strong>{money(preview.subtotal)}đ</strong>
                    </li>
                    {preview.eligible_subtotal != null &&
                    Number(preview.subtotal) !== Number(preview.eligible_subtotal) ? (
                      <li>
                        <span>Phần tiền áp dụng mã (theo danh mục)</span>
                        <strong>{money(preview.eligible_subtotal)}đ</strong>
                      </li>
                    ) : null}
                    <li>
                      <span>Số tiền giảm</span>
                      <strong className="buyer-voucher-result__discount">−{money(preview.discount_amount)}đ</strong>
                    </li>
                    <li className="buyer-voucher-result__total">
                      <span>Tổng thanh toán</span>
                      <strong>{money(preview.total_amount)}đ</strong>
                    </li>
                  </ul>
                </div>
              ) : null}
              {checkoutErr ? (
                <p className="buyer-msg buyer-msg--err" role="alert">
                  {checkoutErr}
                </p>
              ) : null}
              <label className="buyer-form__field" style={{ maxWidth: 400 }}>
                <span className="buyer-form__label">Phương thức thanh toán *</span>
                <select
                  className="buyer-form__input"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  {PAY_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="buyer-form__field" style={{ maxWidth: "100%" }}>
                <span className="buyer-form__label">Địa chỉ giao hàng *</span>
                <textarea
                  className="buyer-form__input"
                  rows={3}
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="Số nhà, đường, phường/xã, tỉnh/thành… (lưu trong hồ sơ để gợi ý lần sau)"
                  required
                />
              </label>
              <p className="buyer-muted" style={{ marginBottom: "0.75rem" }}>
                Đặt hàng lưu địa chỉ và phương thức thanh toán đã chọn; áp dụng mã voucher nếu hợp lệ. Nếu chọn cổng trực
                tuyến, bạn sẽ được chuyển sang trang thanh toán (demo) rồi quay lại đơn hàng.
              </p>
              <button
                type="button"
                className="buyer-form__btn"
                disabled={checkingOut || hasInactiveLine}
                onClick={checkout}
              >
                {checkingOut ? "Đang xử lý…" : paymentMethod === "payment_gateway" ? "Đặt hàng & thanh toán online" : "Đặt hàng"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
