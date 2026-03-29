import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { apiGet, apiPost } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { mapApiProductToCard } from "../utils/mapProduct.js";
import { findDemoProduct, DEMO_PRODUCTS } from "../data/demoProducts.js";
import { addRecentlyViewed } from "../utils/recentlyViewed.js";
import ProductCard from "../components/ProductCard.jsx";
import "./ProductDetailPage.css";

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [qty, setQty] = useState(1);
  const [cartMsg, setCartMsg] = useState("");
  const [cartErr, setCartErr] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewMsg, setReviewMsg] = useState("");
  const [reviewErr, setReviewErr] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError("");
      try {
        const p = await apiGet(`/products/${id}`);
        if (cancelled) return;
        const card = mapApiProductToCard(p);
        setProduct({ ...card, raw: p });
        addRecentlyViewed({
          id: String(p.product_id),
          name: p.product_name,
          price: card.price,
          image: card.image,
          brand: p.brand?.brand_name || ""
        });

        const rel = await apiGet("/products", {
          category_id: p.category_id,
          limit: 5,
          status: "active"
        });
        if (cancelled) return;
        const others = (rel.items || [])
          .filter((x) => String(x.product_id) !== String(p.product_id))
          .slice(0, 4)
          .map(mapApiProductToCard);
        setRelated(others);

        try {
          const rev = await apiGet(`/products/${id}/reviews`);
          if (!cancelled) setReviews(Array.isArray(rev) ? rev : []);
        } catch {
          if (!cancelled) setReviews([]);
        }
      } catch {
        const demo = findDemoProduct(id);
        if (cancelled) return;
        if (!demo) {
          setError("Không tìm thấy sản phẩm.");
          setProduct(null);
          setRelated([]);
        } else {
          const card = { ...demo, id: String(demo.id) };
          setProduct(card);
          addRecentlyViewed({
            id: String(demo.id),
            name: demo.name,
            price: demo.price,
            image: demo.image,
            brand: demo.brand || ""
          });
          const others = DEMO_PRODUCTS.filter(
            (x) => x.brand === demo.brand && String(x.id) !== String(demo.id)
          ).slice(0, 4);
          setRelated(others.map((x) => ({ ...x, id: String(x.id) })));
          setReviews([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="detail-page container">
        <p>Đang tải sản phẩm…</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="detail-page container detail-page--center">
        <p>{error || "Không có dữ liệu."}</p>
        <Link to="/san-pham">← Quay lại danh sách</Link>
      </div>
    );
  }

  const raw = product.raw;
  const desc =
    raw?.description ||
    "Mô tả chi tiết đang được cập nhật. Liên hệ hotline để được tư vấn kỹ thuật và báo giá.";

  const apiProductId = raw?.product_id ? String(raw.product_id) : String(product.id);
  const canBuy = !product.contactOnly && (raw?.stock_quantity == null || raw.stock_quantity > 0);

  async function addToCart() {
    setCartMsg("");
    setCartErr("");
    if (!raw) {
      setCartErr("Sản phẩm demo: vui lòng dùng sản phẩm từ danh mục có trên server để thêm giỏ.");
      return;
    }
    if (!user) {
      navigate("/dang-nhap", {
        state: {
          from: location,
          message:
            "Đăng nhập hoặc đăng ký tài khoản để thêm sản phẩm vào giỏ hàng. Sau khi đăng nhập bạn sẽ quay lại trang này."
        }
      });
      return;
    }
    if (!canBuy) return;
    try {
      await apiPost(
        "/cart/items",
        { product_id: apiProductId, quantity: Math.max(1, qty) },
        { auth: true }
      );
      window.dispatchEvent(new Event("bd-cart-updated"));
      setCartMsg("Đã thêm vào giỏ hàng.");
    } catch (e) {
      setCartErr(e.message || "Không thêm được.");
    }
  }

  async function submitReview(e) {
    e.preventDefault();
    setReviewMsg("");
    setReviewErr("");
    if (!raw) {
      setReviewErr("Đánh giá chỉ áp dụng cho sản phẩm trên hệ thống.");
      return;
    }
    if (!user) {
      navigate("/dang-nhap", {
        state: {
          from: location,
          message: "Đăng nhập để gửi đánh giá sản phẩm."
        }
      });
      return;
    }
    setReviewSubmitting(true);
    try {
      await apiPost(
        `/reviews/products/${apiProductId}`,
        { rating: reviewRating, comment: reviewComment.trim() || null },
        { auth: true }
      );
      setReviewMsg("Cảm ơn bạn đã đánh giá.");
      setReviewComment("");
      const rev = await apiGet(`/products/${id}/reviews`);
      setReviews(Array.isArray(rev) ? rev : []);
    } catch (e) {
      setReviewErr(e.message || "Không gửi được đánh giá.");
    } finally {
      setReviewSubmitting(false);
    }
  }

  return (
    <div className="detail-page">
      <div className="container detail-page__breadcrumb">
        <Link to="/">Trang chủ</Link>
        <span aria-hidden> / </span>
        <Link to="/san-pham">Sản phẩm</Link>
        <span aria-hidden> / </span>
        <span>{product.name}</span>
      </div>

      <div className="container detail-page__grid">
        <div className="detail-page__media">
          {product.image ? (
            <img src={product.image} alt="" className="detail-page__img" />
          ) : (
            <div className="detail-page__placeholder" />
          )}
        </div>
        <div className="detail-page__info">
          <h1 className="detail-page__title">{product.name}</h1>
          {product.flashSale ? (
            <p className="detail-page__flash-tag" role="status">
              Flash sale — giá ưu đãi có thời hạn
            </p>
          ) : null}
          {product.sku ? (
            <p className="detail-page__sku">SKU: {product.sku}</p>
          ) : null}
          <div className="detail-page__price-row">
            {product.contactOnly ? (
              <span className="detail-page__price-contact">Liên hệ</span>
            ) : (
              <>
                <span className="detail-page__price">
                  {Number(product.price).toLocaleString("vi-VN")}đ
                </span>
                {product.oldPrice ? (
                  <span className="detail-page__old">
                    {Number(product.oldPrice).toLocaleString("vi-VN")}đ
                  </span>
                ) : null}
              </>
            )}
          </div>
          {raw?.stock_quantity != null ? (
            <p className="detail-page__stock">Tồn kho: {raw.stock_quantity}</p>
          ) : null}
          {raw?.warranty_months ? (
            <p className="detail-page__warranty">
              Bảo hành: {raw.warranty_months} tháng
            </p>
          ) : null}
          <div className="detail-page__qty-row">
            <label className="detail-page__qty-label">
              Số lượng
              <input
                type="number"
                className="detail-page__qty-input"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
              />
            </label>
          </div>
          {cartErr ? <p className="detail-page__inline-err">{cartErr}</p> : null}
          {cartMsg ? <p className="detail-page__inline-ok">{cartMsg}</p> : null}
          <button type="button" className="detail-page__cta" disabled={!canBuy} onClick={addToCart}>
            {canBuy ? "Thêm vào giỏ hàng" : "Tạm hết hàng / liên hệ"}
          </button>
        </div>
      </div>

      <div className="container detail-page__desc">
        <h2 className="detail-page__h2">Chi tiết sản phẩm</h2>
        <p className="detail-page__text">{desc}</p>
      </div>

      <section className="container detail-page__reviews" aria-labelledby="reviews-h">
        <h2 id="reviews-h" className="detail-page__h2">
          Đánh giá (Write Review)
        </h2>
        {reviews.length > 0 ? (
          <ul className="detail-page__review-list">
            {reviews.map((r) => (
              <li key={r.review_id} className="detail-page__review-item">
                <strong>{r.user?.full_name || "Khách"}</strong>
                <span className="detail-page__review-stars"> {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                {r.comment ? <p className="detail-page__review-comment">{r.comment}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="detail-page__text">Chưa có đánh giá.</p>
        )}
        {user ? (
          <form className="detail-page__review-form" onSubmit={submitReview}>
            <p className="detail-page__text">Viết đánh giá sản phẩm bạn đã mua (mỗi sản phẩm một lần).</p>
            <label className="detail-page__review-field">
              Điểm (1–5)
              <select value={reviewRating} onChange={(e) => setReviewRating(Number(e.target.value))}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="detail-page__review-field">
              Nhận xét
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                rows={3}
                placeholder="Chia sẻ trải nghiệm sử dụng…"
              />
            </label>
            {reviewErr ? <p className="detail-page__inline-err">{reviewErr}</p> : null}
            {reviewMsg ? <p className="detail-page__inline-ok">{reviewMsg}</p> : null}
            <button type="submit" className="detail-page__cta detail-page__cta--secondary" disabled={reviewSubmitting}>
              {reviewSubmitting ? "Đang gửi…" : "Gửi đánh giá"}
            </button>
          </form>
        ) : (
          <p className="detail-page__text">
            <Link to="/dang-nhap" state={{ from: location }}>
              Đăng nhập
            </Link>{" "}
            để viết đánh giá.
          </p>
        )}
      </section>

      {related.length > 0 ? (
        <section className="detail-page__related" aria-labelledby="related-h">
          <div className="container">
            <h2 id="related-h" className="detail-page__h2 detail-page__h2--bar">
              <span className="detail-page__accent" aria-hidden />
              Sản phẩm liên quan
            </h2>
            <ul className="detail-page__related-grid">
              {related.map((p) => (
                <li key={p.id || p.product_id}>
                  <ProductCard product={p} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </div>
  );
}
