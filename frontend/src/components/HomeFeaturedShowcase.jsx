import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { mapApiProductToCard } from "../utils/mapProduct.js";

/** Tự chuyển sau khi animation chậm (~1.35s) kết thúc — còn thời gian xem sản phẩm */
const INTERVAL_MS = 7000;

function money(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `${Number(n).toLocaleString("vi-VN")}đ`;
}

function truncate(s, max) {
  const t = String(s || "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Bước ngắn nhất giữa hai index (carousel vòng) → hướng +1 hoặc -1 */
function shortestStepDir(from, to, len) {
  if (len < 2) return 0;
  const forward = (to - from + len) % len;
  const backward = (from - to + len) % len;
  return forward <= backward ? 1 : -1;
}

/**
 * Nổi bật: ảnh lớn trượt ngang (kiểu slide PowerPoint), hai ảnh phụ trượt dọc.
 */
export default function HomeFeaturedShowcase({ products = [] }) {
  const cards = useMemo(() => (products || []).map(mapApiProductToCard), [products]);
  const n = cards.length;
  const [idx, setIdx] = useState(0);
  /** 0 = lần đầu (không trượt ngang); 1 = tiến; -1 = lùi */
  const [slideDir, setSlideDir] = useState(0);

  const safeIdx = n > 0 ? ((idx % n) + n) % n : 0;
  const main = n > 0 ? cards[safeIdx] : null;
  const side1 = n > 0 ? cards[(safeIdx + 1) % n] : null;
  const side2 = n > 0 ? cards[(safeIdx + 2) % n] : null;

  const mainMotionClass =
    slideDir === 0
      ? "home-featured-main__inner--init"
      : slideDir === 1
        ? "home-featured-main__inner--next"
        : "home-featured-main__inner--prev";

  const sideMotionClass =
    slideDir === 0
      ? "home-featured-side__inner--init"
      : slideDir === 1
        ? "home-featured-side__inner--next"
        : "home-featured-side__inner--prev";

  const go = useCallback(
    (dir) => {
      if (n < 1) return;
      setSlideDir(dir);
      setIdx((i) => (i + dir + n) % n);
    },
    [n]
  );

  const goToIndex = useCallback(
    (target) => {
      if (n < 2 || target === safeIdx) return;
      setSlideDir(shortestStepDir(safeIdx, target, n));
      setIdx(target);
    },
    [n, safeIdx]
  );

  useEffect(() => {
    if (n < 2) return undefined;
    const t = window.setInterval(() => {
      setSlideDir(1);
      setIdx((i) => (i + 1) % n);
    }, INTERVAL_MS);
    return () => window.clearInterval(t);
  }, [n]);

  if (!main) return null;

  return (
    <div className="home__hero-showcase">
      <section className="home__banner-main" aria-label="Sản phẩm nổi bật">
        <div
          className="home__hero-carousel home-featured-carousel home__banner-card home__banner-card--large home__banner-card--wood"
          role="region"
          aria-roledescription="carousel"
          aria-label="Sản phẩm nổi bật — ảnh và giá từ cửa hàng"
          aria-live="polite"
        >
          <span className="home__hero-brand-tag">{main.brand || "Nổi bật"}</span>
          <div className="home-featured-main__clip">
            <Link
              to={`/san-pham/${main.id}`}
              className="home-featured-hero__link home-featured-hero__link--main"
            >
              <div
                key={`feat-main-${safeIdx}-${main.id}`}
                className={`home-featured-main__inner ${mainMotionClass}`}
              >
                {main.image ? (
                  <img
                    src={main.image}
                    alt=""
                    className="home__banner-img home__banner-img--hero"
                    loading="lazy"
                  />
                ) : (
                  <div className="home-featured-hero__img-ph" aria-hidden />
                )}
                <div className="home__banner-deWalt" aria-hidden>
                  {main.brand || "SẢN PHẨM"}
                </div>
                <div className="home__banner-overlay">
                  <p className="home__banner-kicker">{main.sku ? `SKU · ${main.sku}` : "Sản phẩm nổi bật"}</p>
                  <h2 className="home__banner-title">{truncate(main.name, 72)}</h2>
                  <p className="home__banner-price">
                    {main.contactOnly ? "Liên hệ" : money(main.price)}
                  </p>
                  {main.flashSale || main.hot ? (
                    <div className="home__banner-badges" aria-hidden>
                      {main.flashSale ? (
                        <span className="home__banner-badge-chip">Flash sale</span>
                      ) : null}
                      {main.hot ? (
                        <span className="home__banner-badge-chip home__banner-badge-chip--xr">Hot</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </Link>
          </div>
          {n > 1 ? (
            <>
              <button
                type="button"
                className="home__hero-nav home__hero-nav--prev"
                aria-label="Sản phẩm trước"
                onClick={() => go(-1)}
              />
              <button
                type="button"
                className="home__hero-nav home__hero-nav--next"
                aria-label="Sản phẩm sau"
                onClick={() => go(1)}
              />
              <div className="home__hero-dots" role="tablist" aria-label="Chọn sản phẩm">
                {cards.map((c, i) => (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={i === safeIdx}
                    className={`home__hero-dot ${i === safeIdx ? "home__hero-dot--active" : ""}`}
                    onClick={() => goToIndex(i)}
                    aria-label={`${i + 1} / ${n}`}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>
      </section>

      <div className="home__banners-side">
        {side1 ? (
          <Link
            key={`feat-s1-${side1.id}`}
            to={`/san-pham/${side1.id}`}
            className="home-featured-hero__link home-featured-hero__link--side"
          >
            <div className="home__banner-card home__banner-card--small home-featured-side-card">
              <div className="home-featured-side__clip">
                <div
                  key={`feat-s1-inner-${safeIdx}-${side1.id}`}
                  className={`home-featured-side__inner ${sideMotionClass} home-featured-side__inner--delay-1`}
                >
                  {side1.image ? (
                    <img src={side1.image} alt="" className="home__banner-img" loading="lazy" />
                  ) : (
                    <div className="home-featured-hero__img-ph home-featured-hero__img-ph--side" aria-hidden />
                  )}
                  <div className="home__banner-overlay home__banner-overlay--compact">
                    <span className="home__banner-kicker">{side1.brand || "—"}</span>
                    <span className="home__banner-title home__banner-title--sm">{truncate(side1.name, 52)}</span>
                    <span className="home__banner-price home__banner-price--side">
                      {side1.contactOnly ? "Liên hệ" : money(side1.price)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ) : null}
        {side2 ? (
          <Link
            key={`feat-s2-${side2.id}`}
            to={`/san-pham/${side2.id}`}
            className="home-featured-hero__link home-featured-hero__link--side"
          >
            <div className="home__banner-card home__banner-card--small home-featured-side-card">
              <div className="home-featured-side__clip">
                <div
                  key={`feat-s2-inner-${safeIdx}-${side2.id}`}
                  className={`home-featured-side__inner ${sideMotionClass} home-featured-side__inner--delay-2`}
                >
                  {side2.image ? (
                    <img src={side2.image} alt="" className="home__banner-img" loading="lazy" />
                  ) : (
                    <div className="home-featured-hero__img-ph home-featured-hero__img-ph--side" aria-hidden />
                  )}
                  <div className="home__banner-overlay home__banner-overlay--compact">
                    <span className="home__banner-kicker">{side2.brand || "—"}</span>
                    <span className="home__banner-title home__banner-title--sm">{truncate(side2.name, 52)}</span>
                    <span className="home__banner-price home__banner-price--side">
                      {side2.contactOnly ? "Liên hệ" : money(side2.price)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
