import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { apiDelete, apiGet, apiPost } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { mapApiProductToCard } from "../utils/mapProduct.js";
import { findDemoProduct, DEMO_PRODUCTS } from "../data/demoProducts.js";
import { addRecentlyViewed } from "../utils/recentlyViewed.js";
import ProductCard from "../components/ProductCard.jsx";
import { CoreButton, CoreMessage, CoreSpinner } from "../components/ui/index.js";

function formatMoney(value) {
  if (value == null || Number.isNaN(Number(value))) return "";
  return `${Number(value).toLocaleString("vi-VN")}đ`;
}

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
  const [commentText, setCommentText] = useState({});
  const [commentBusy, setCommentBusy] = useState({});

  async function refreshReviews() {
    try {
      const rev = await apiGet(`/products/${id}/reviews`);
      setReviews(Array.isArray(rev) ? rev : []);
    } catch {
      setReviews([]);
    }
  }

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
        <div className="detail-page__loading">
          <CoreSpinner style={{ width: "2.2rem", height: "2.2rem" }} strokeWidth="6" />
        </div>
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
  const isCatalogActive = raw == null ? true : raw.status === "active";
  const canBuy = !product.contactOnly && (raw?.stock_quantity == null || raw.stock_quantity > 0);
  const myReview = user ? reviews.some((r) => String(r.user_id) === String(user.user_id)) : false;
  const stockState =
    raw?.stock_quantity == null
      ? "Liên hệ để kiểm tra tồn kho"
      : raw.stock_quantity > 0
        ? "Còn hàng"
        : "Tạm hết hàng";
  const productHighlights = [
    { label: "Thương hiệu", value: product.brand || "Đang cập nhật" },
    { label: "Danh mục", value: raw?.category?.category_name || product.category || "Đang cập nhật" },
    { label: "Mã sản phẩm", value: product.sku || "Đang cập nhật" },
    { label: "Bảo hành", value: raw?.warranty_months ? `${raw.warranty_months} tháng` : "Theo chính sách hãng" },
    { label: "Tình trạng", value: stockState }
  ];

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
    if (!isCatalogActive) {
      setCartErr("Sản phẩm đã ngừng kinh doanh — không thể thêm vào giỏ.");
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
      const created = await apiPost(
        `/reviews/products/${apiProductId}`,
        { rating: reviewRating, comment: reviewComment.trim() || null },
        { auth: true }
      );
      setReviewMsg(
        created?.moderation_status === "pending"
          ? "Đã gửi đánh giá. Nội dung sẽ hiển thị công khai sau khi được duyệt."
          : "Cảm ơn bạn đã đánh giá."
      );
      setReviewComment("");
      await refreshReviews();
    } catch (e) {
      setReviewErr(e.message || "Không gửi được đánh giá.");
    } finally {
      setReviewSubmitting(false);
    }
  }

  async function submitComment(reviewId, e) {
    e.preventDefault();
    const text = (commentText[reviewId] || "").trim();
    if (!text || !raw) return;
    setCommentBusy((b) => ({ ...b, [reviewId]: true }));
    try {
      await apiPost(`/reviews/${reviewId}/comments`, { body: text }, { auth: true });
      setCommentText((prev) => ({ ...prev, [reviewId]: "" }));
      await refreshReviews();
    } catch (e2) {
      window.alert(e2.message || "Không gửi được bình luận.");
    } finally {
      setCommentBusy((b) => ({ ...b, [reviewId]: false }));
    }
  }

  async function deleteComment(commentId) {
    if (!window.confirm("Xóa bình luận này?")) return;
    try {
      await apiDelete(`/reviews/comments/${commentId}`, { auth: true });
      await refreshReviews();
    } catch (e2) {
      window.alert(e2.message || "Không xóa được.");
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
            <img
              src={product.image}
              alt=""
              className="detail-page__img"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="detail-page__placeholder" />
          )}
        </div>
        <div className="detail-page__info">
          <div className="detail-page__meta-row">
            {product.brand ? <span className="detail-page__pill">{product.brand}</span> : null}
            {raw?.category?.category_name || product.category ? (
              <span className="detail-page__pill detail-page__pill--soft">
                {raw?.category?.category_name || product.category}
              </span>
            ) : null}
          </div>
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
                <span className="detail-page__price">{formatMoney(product.price)}</span>
                {product.oldPrice ? (
                  <span className="detail-page__old">{formatMoney(product.oldPrice)}</span>
                ) : null}
              </>
            )}
          </div>
          {product.discount ? (
            <p className="detail-page__save">Tiết kiệm {product.discount}% so với giá niêm yết.</p>
          ) : null}
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
          {cartErr ? <CoreMessage severity="error" text={cartErr} className="detail-page__inline-msg" /> : null}
          {cartMsg ? <CoreMessage severity="success" text={cartMsg} className="detail-page__inline-msg" /> : null}
          {!isCatalogActive && raw ? (
            <p className="detail-page__inline-err" role="status">
              Sản phẩm đã ngừng kinh doanh (admin đã tắt) — không thể thêm vào giỏ.
            </p>
          ) : null}
          <CoreButton
            type="button"
            tone="secondary"
            className="detail-page__cta"
            disabled={!canBuy || !isCatalogActive}
            onClick={addToCart}
          >
            {!isCatalogActive && raw
              ? "Ngừng kinh doanh"
              : canBuy
                ? "Thêm vào giỏ hàng"
                : "Tạm hết hàng / liên hệ"}
          </CoreButton>
          <ul className="detail-page__trust-list">
            <li>Tư vấn kỹ thuật đúng nhu cầu sử dụng thực tế.</li>
            <li>Hỗ trợ hóa đơn VAT và giao hàng toàn quốc.</li>
            <li>Bảo hành rõ ràng theo chính sách hãng và cửa hàng.</li>
          </ul>
        </div>
      </div>

      <div className="container detail-page__highlights">
        <h2 className="detail-page__h2">Thông tin nổi bật</h2>
        <dl className="detail-page__highlight-grid">
          {productHighlights.map((item) => (
            <div className="detail-page__highlight-item" key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="container detail-page__support">
        <div className="detail-page__support-card">
          <h2 className="detail-page__h2">Mua hàng & hỗ trợ</h2>
          <p className="detail-page__text">
            Cần báo giá số lượng lớn hoặc tư vấn model phù hợp? Đội ngũ kỹ thuật sẵn sàng hỗ trợ nhanh qua hotline và
            email.
          </p>
          <div className="detail-page__support-actions">
            <a href="tel:1900633017" className="detail-page__support-link">
              Hotline: 1900 633 017
            </a>
            <a href="mailto:sales@binhdinhtools.com" className="detail-page__support-link">
              sales@binhdinhtools.com
            </a>
          </div>
        </div>
      </div>

      <div className="container detail-page__desc">
        <h2 className="detail-page__h2">Chi tiết sản phẩm</h2>
        <p className="detail-page__text">{desc}</p>
      </div>

      <section className="container detail-page__reviews" aria-labelledby="reviews-h">
        <h2 id="reviews-h" className="detail-page__h2">
          Đánh giá sản phẩm
        </h2>
        <p className="detail-page__text detail-page__reviews--hint">
          Chỉ đánh giá đã duyệt hiển thị công khai. Quản trị viên có thể duyệt, ẩn hoặc xóa. Đăng nhập để cho điểm (1–5 sao),
          viết nhận xét và trả lời đánh giá.
        </p>
        {reviews.length > 0 ? (
          <ul className="detail-page__review-list">
            {reviews.map((r) => (
              <li key={r.review_id} className="detail-page__review-item">
                <div className="detail-page__review-head">
                  <strong>{r.user?.full_name || "Khách"}</strong>
                  <span className="detail-page__review-stars">
                    {" "}
                    {"★".repeat(r.rating)}
                    {"☆".repeat(5 - r.rating)}
                  </span>
                  {r.moderation_status && r.moderation_status !== "approved" ? (
                    <span className={`detail-page__review-badge detail-page__review-badge--${r.moderation_status}`}>
                      {r.moderation_status === "pending" ? "Chờ duyệt" : "Không hiển thị công khai"}
                    </span>
                  ) : null}
                </div>
                {r.comment ? <p className="detail-page__review-comment">{r.comment}</p> : null}

                {r.moderation_status === "approved" && Array.isArray(r.comments) && r.comments.length > 0 ? (
                  <ul className="detail-page__review-comments">
                    {r.comments.map((c) => (
                      <li key={c.review_comment_id} className="detail-page__review-comments-item">
                        <strong>{c.user?.full_name || "Khách"}</strong>
                        <span className="detail-page__review-comments-body">{c.body}</span>
                        {user && String(c.user_id) === String(user.user_id) ? (
                          <button
                            type="button"
                            className="detail-page__review-comments-del"
                            onClick={() => deleteComment(c.review_comment_id)}
                          >
                            Xóa
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {user && r.moderation_status === "approved" ? (
                  <form className="detail-page__review-comment-form" onSubmit={(e) => submitComment(r.review_id, e)}>
                    <label className="detail-page__review-field detail-page__review-field--inline">
                      <span className="detail-page__review-field-label">Bình luận</span>
                      <textarea
                        rows={2}
                        placeholder="Trả lời đánh giá…"
                        value={commentText[r.review_id] || ""}
                        onChange={(e) =>
                          setCommentText((prev) => ({ ...prev, [r.review_id]: e.target.value }))
                        }
                      />
                    </label>
                    <CoreButton
                      type="submit"
                      tone="primary"
                      className="detail-page__cta detail-page__cta--secondary detail-page__cta--small"
                      disabled={commentBusy[r.review_id]}
                    >
                      {commentBusy[r.review_id] ? "Đang gửi…" : "Gửi bình luận"}
                    </CoreButton>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="detail-page__text">Chưa có đánh giá.</p>
        )}
        {user && !myReview ? (
          <form className="detail-page__review-form" onSubmit={submitReview}>
            <p className="detail-page__text">Viết đánh giá (mỗi sản phẩm một lần).</p>
            <div className="detail-page__review-field">
              <span className="detail-page__review-field-label">Điểm (1–5)</span>
              <div className="detail-page__rating-picker" role="group" aria-label="Chọn điểm từ 1 đến 5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`detail-page__rating-star${n <= reviewRating ? " detail-page__rating-star--on" : ""}`}
                    onClick={() => setReviewRating(n)}
                    aria-pressed={n <= reviewRating}
                    aria-label={`${n} sao`}
                  >
                    ★
                  </button>
                ))}
                <span className="detail-page__rating-value" aria-hidden="true">
                  {reviewRating}/5
                </span>
              </div>
            </div>
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
            <CoreButton type="submit" tone="primary" className="detail-page__cta detail-page__cta--secondary" disabled={reviewSubmitting}>
              {reviewSubmitting ? "Đang gửi…" : "Gửi đánh giá"}
            </CoreButton>
          </form>
        ) : user && myReview ? (
          <p className="detail-page__text">Bạn đã gửi đánh giá cho sản phẩm này.</p>
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
