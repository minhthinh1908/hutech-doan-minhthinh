import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiPost } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { CoreButton, CoreCard } from "./ui/index.js";

function formatMoney(n) {
  if (n == null || Number.isNaN(n)) return "";
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "đ";
}

export default function ProductCard({ product, compact = false }) {
  const {
    name,
    image,
    price,
    oldPrice,
    discount,
    hot,
    flashSale,
    contactOnly
  } = product;

  const { user } = useAuth();
  const navigate = useNavigate();
  const pid = product.id ?? product.product_id;
  const detailTo = pid != null ? `/san-pham/${pid}` : null;
  const [addErr, setAddErr] = useState("");

  async function handleAddToCart(e) {
    e.preventDefault();
    e.stopPropagation();
    setAddErr("");
    if (!detailTo || contactOnly) return;
    if (!user) {
      navigate("/dang-nhap", {
        state: {
          from: { pathname: detailTo, search: "", hash: "" },
          message:
            "Đăng nhập hoặc đăng ký để thêm sản phẩm vào giỏ. Sau khi đăng nhập bạn sẽ quay lại trang sản phẩm."
        }
      });
      return;
    }
    try {
      await apiPost("/cart/items", { product_id: String(pid), quantity: 1 }, { auth: true });
      window.dispatchEvent(new Event("bd-cart-updated"));
    } catch (err) {
      const msg = err?.message || "";
      if (/401|token|Unauthorized|missing/i.test(msg)) {
        navigate("/dang-nhap", {
          state: {
            from: { pathname: detailTo, search: "", hash: "" },
            message: "Phiên đăng nhập hết hạn. Đăng nhập lại để thêm giỏ hàng."
          }
        });
      } else {
        setAddErr(msg || "Không thêm được vào giỏ. Thử mở trang chi tiết sản phẩm từ danh mục hệ thống.");
      }
    }
  }

  const inner = (
    <>
      {flashSale ? <span className="product-card__flash">Flash sale</span> : null}
      {hot ? <span className="product-card__hot">Hot</span> : null}
      {!contactOnly && discount != null && discount > 0 ? (
        <span className="product-card__discount">-{discount}%</span>
      ) : null}

      <div className="product-card__img-wrap">
        {image ? (
          <img src={image} alt="" className="product-card__img" loading="lazy" />
        ) : (
          <div className="product-card__placeholder" aria-hidden />
        )}
      </div>

      <h3 className="product-card__name">{name}</h3>

      <div className="product-card__prices">
        {contactOnly ? (
          <span className="product-card__contact">Liên hệ</span>
        ) : (
          <>
            <span className="product-card__price">{formatMoney(price)}</span>
            {oldPrice != null && oldPrice > (price || 0) ? (
              <span className="product-card__old">{formatMoney(oldPrice)}</span>
            ) : null}
          </>
        )}
      </div>
    </>
  );

  return (
    <CoreCard
      className={`product-card ${compact ? "product-card--compact" : ""}${hot && flashSale ? " product-card--dual-badges" : ""}`}
    >
      {detailTo ? (
        <Link to={detailTo} className="product-card__link">
          {inner}
        </Link>
      ) : (
        inner
      )}

      {!contactOnly ? (
        <CoreButton type="button" tone="secondary" className="product-card__btn" onClick={handleAddToCart}>
          Thêm vào giỏ
        </CoreButton>
      ) : null}
      {addErr ? <p className="product-card__err">{addErr}</p> : null}
    </CoreCard>
  );
}
