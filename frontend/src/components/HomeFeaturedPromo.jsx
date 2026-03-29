import { Link } from "react-router-dom";
import "./HomeFeaturedPromo.css";

function money(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `${Number(n).toLocaleString("vi-VN")}đ`;
}

/**
 * Khối «Nổi bật» kiểu banner + ảnh sản phẩm + nhãn gọi (tham chiếu layout khuyến mãi công cụ).
 */
export default function HomeFeaturedPromo({ products = [] }) {
  if (!products.length) return null;

  return (
    <section className="home-fpromo" aria-labelledby="home-fpromo-heading">
      <div className="container home-fpromo__inner">
        <h2 id="home-fpromo-heading" className="home-fpromo__title">
          <span className="home-fpromo__title-accent" aria-hidden />
          Sản phẩm nổi bật
        </h2>
        <div className="home-fpromo__grid">
          {products.map((p) => {
            const id = String(p.product_id ?? p.id);
            const img = p.image_url || "";
            const side = p.featured_side_image_url?.trim() || img;
            const brandName = p.brand?.brand_name || "";
            const title =
              (p.featured_banner_title && p.featured_banner_title.trim()) || brandName || "PROMO";
            const sub =
              (p.featured_banner_subtitle && p.featured_banner_subtitle.trim()) || "KHUYẾN MÃI HOT";
            const l1 = p.featured_label_1?.trim() || p.sku || "";
            const l2 = p.featured_label_2?.trim() || "";
            const price = p.price != null ? Number(p.price) : 0;
            const contact = Boolean(p.contact_only);

            return (
              <article key={id} className="home-fpromo__card">
                <Link to={`/san-pham/${id}`} className="home-fpromo__card-link">
                  <div className="home-fpromo__layout">
                    <div className="home-fpromo__col home-fpromo__col--side">
                      {side ? (
                        <img src={side} alt="" className="home-fpromo__side-img" loading="lazy" />
                      ) : (
                        <div className="home-fpromo__side-ph" aria-hidden />
                      )}
                    </div>
                    <div className="home-fpromo__col home-fpromo__col--stack">
                      <div className="home-fpromo__banner">
                        <span className="home-fpromo__banner-brand">{title}</span>
                        <span className="home-fpromo__banner-sub">{sub}</span>
                      </div>
                      <div className="home-fpromo__spotlight">
                        <div className="home-fpromo__spotlight-bg" aria-hidden />
                        {img ? (
                          <img src={img} alt="" className="home-fpromo__product-img" loading="lazy" />
                        ) : (
                          <div className="home-fpromo__product-ph" />
                        )}
                        {l1 ? (
                          <span className="home-fpromo__callout home-fpromo__callout--a">{l1}</span>
                        ) : null}
                        {l2 ? (
                          <span className="home-fpromo__callout home-fpromo__callout--b">{l2}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="home-fpromo__meta">
                    <h3 className="home-fpromo__name">{p.product_name}</h3>
                    <p className="home-fpromo__price">
                      {contact ? (
                        <span className="home-fpromo__contact">Liên hệ</span>
                      ) : (
                        money(price)
                      )}
                    </p>
                  </div>
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
