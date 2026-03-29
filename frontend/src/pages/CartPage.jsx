import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiDelete, apiGet, apiPatch, apiPost } from "../api/client.js";
import BuyerSidebar from "../components/BuyerSidebar.jsx";
import "./BuyerPages.css";

function money(n) {
  return Number(n || 0).toLocaleString("vi-VN");
}

export default function CartPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [voucherCode, setVoucherCode] = useState("");
  const [checkoutErr, setCheckoutErr] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewErr, setPreviewErr] = useState("");
  const [previewing, setPreviewing] = useState(false);

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
    const q = Math.max(1, quantity);
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
    setCheckingOut(true);
    try {
      const body = {};
      if (voucherCode.trim()) body.voucher_code = voucherCode.trim();
      const order = await apiPost("/orders", body, { auth: true });
      window.dispatchEvent(new Event("bd-cart-updated"));
      navigate(`/don-hang/${order.order_id}`);
    } catch (e) {
      setCheckoutErr(e.message || "Đặt hàng thất bại.");
    } finally {
      setCheckingOut(false);
    }
  }

  const subtotal = items.reduce((s, i) => s + Number(i.unit_price) * i.quantity, 0);

  return (
    <div className="buyer-page">
      <div className="buyer-page__hero">
        <div className="container">
          <h1 className="buyer-page__title">Giỏ hàng</h1>
          <p className="buyer-page__sub">Thêm, sửa số lượng và đặt hàng (áp dụng mã giảm giá nếu có).</p>
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
            return (
              <div key={line.cart_item_id} className="buyer-cart-row">
                {img ? (
                  <img className="buyer-cart-thumb" src={img} alt="" />
                ) : (
                  <div className="buyer-cart-thumb" />
                )}
                <div>
                  <Link to={`/san-pham/${line.product_id}`}>
                    <strong>{name}</strong>
                  </Link>
                  <div className="buyer-muted">{money(line.unit_price)}đ / sản phẩm</div>
                </div>
                <div className="buyer-qty">
                  <button type="button" aria-label="Giảm" onClick={() => setQty(line.cart_item_id, line.quantity - 1)}>
                    −
                  </button>
                  <span>{line.quantity}</span>
                  <button type="button" aria-label="Tăng" onClick={() => setQty(line.cart_item_id, line.quantity + 1)}>
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
              <label className="buyer-form__field" style={{ maxWidth: 320 }}>
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
                    {previewing ? "Đang kiểm tra…" : "Kiểm tra mã"}
                  </button>
                </div>
              </label>
              {previewErr ? (
                <p className="buyer-msg buyer-msg--err" role="alert">
                  {previewErr}
                </p>
              ) : null}
              {preview ? (
                <p className="buyer-msg" style={{ background: "#e8f5e9", color: "#1b5e20", padding: "0.5rem 0.75rem", borderRadius: 4 }}>
                  Giảm <strong>{money(preview.discount_amount)}đ</strong> — Tổng sau giảm:{" "}
                  <strong>{money(preview.total_amount)}đ</strong>
                </p>
              ) : null}
              {checkoutErr ? (
                <p className="buyer-msg buyer-msg--err" role="alert">
                  {checkoutErr}
                </p>
              ) : null}
              <p className="buyer-muted" style={{ marginBottom: "0.75rem" }}>
                Đặt hàng sẽ tạo đơn và chuyển bạn sang bước thanh toán. Áp dụng voucher khi đặt hàng (theo use case «Apply
                Voucher»).
              </p>
              <button type="button" className="buyer-form__btn" disabled={checkingOut} onClick={checkout}>
                {checkingOut ? "Đang xử lý…" : "Đặt hàng & thanh toán"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
