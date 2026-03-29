import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ProductCard from "../components/ProductCard.jsx";
import HomeFeaturedPromo from "../components/HomeFeaturedPromo.jsx";
import HomeRecommendations from "../components/HomeRecommendations.jsx";
import RecentlyViewedStrip from "../components/RecentlyViewedStrip.jsx";
import { apiGet } from "../api/client.js";
import { mapApiProductToCard } from "../utils/mapProduct.js";
import { buildSlugToBrandId, brandToUrlSlug, resolveBrandParam } from "../utils/brandSlug.js";
import { buildDisplayOrderBrandIds, orderedBrandIdsForRoot } from "../utils/brandByCategory.js";
import { buildHeroSequence } from "../data/homeBrandShowcase.js";
import { MEGA_COLS, splitIntoColumns } from "../utils/categoryMega.js";
import "./HomePage.css";

const SIDEBAR_ITEMS = [
  "MÁY MÓC CẦM TAY",
  "PHỤ KIỆN",
  "VẬT LIỆU",
  "ĐỒ NGHỀ CẦM TAY",
  "BẢO QUẢN",
  "DỤNG CỤ ĐO LƯỜNG"
];

const HERO_SHOWCASE_INTERVAL_MS = 4500;

export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const brandParam = searchParams.get("brand");
  const [tab, setTab] = useState("bestseller");
  /** brand_id (chuỗi) — đồng bộ với Admin / GET /brands */
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [heroFlatIndex, setHeroFlatIndex] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const carouselRef = useRef(null);

  const [brands, setBrands] = useState([]);
  const [slugToBrandId, setSlugToBrandId] = useState({});
  const [carouselProducts, setCarouselProducts] = useState([]);
  const [gridProducts, setGridProducts] = useState([]);
  const [loadCarousel, setLoadCarousel] = useState(true);
  const [loadGrid, setLoadGrid] = useState(true);
  const [carouselErr, setCarouselErr] = useState("");
  const [gridErr, setGridErr] = useState("");
  const [featuredRaw, setFeaturedRaw] = useState([]);
  const [flashProducts, setFlashProducts] = useState([]);
  const [loadPromoBlocks, setLoadPromoBlocks] = useState(true);
  const [categoryTree, setCategoryTree] = useState([]);
  const [byRootBrands, setByRootBrands] = useState({});
  const [sidebarMegaOpen, setSidebarMegaOpen] = useState(false);
  const [activeSidebarRootId, setActiveSidebarRootId] = useState(null);
  const sidebarLeaveTimer = useRef(null);

  const heroSequence = useMemo(() => buildHeroSequence(), []);
  const heroFlatLen = heroSequence.length;
  const safeHeroIndex =
    heroFlatLen > 0
      ? ((heroFlatIndex % heroFlatLen) + heroFlatLen) % heroFlatLen
      : 0;
  const currentHero = heroSequence[safeHeroIndex];
  const main = currentHero?.slide?.main;
  const side1 = currentHero?.slide?.side1;
  const side2 = currentHero?.slide?.side2;

  const goHero = useCallback(
    (dir) => {
      if (heroFlatLen < 1) return;
      setHeroFlatIndex((i) => (i + dir + heroFlatLen) % heroFlatLen);
    },
    [heroFlatLen]
  );

  useEffect(() => {
    if (heroPaused || heroFlatLen < 2) return undefined;
    const t = window.setInterval(() => {
      setHeroFlatIndex((i) => (i + 1) % heroFlatLen);
    }, HERO_SHOWCASE_INTERVAL_MS);
    return () => window.clearInterval(t);
  }, [heroPaused, heroFlatLen]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [list, cb] = await Promise.all([apiGet("/brands"), apiGet("/category-brands")]);
        if (cancelled) return;
        const arr = Array.isArray(list) ? list : [];
        setBrands(arr);
        setSlugToBrandId(buildSlugToBrandId(arr));
        setByRootBrands(cb?.by_root && typeof cb.by_root === "object" ? cb.by_root : {});
      } catch {
        if (!cancelled) {
          setBrands([]);
          setSlugToBrandId({});
          setByRootBrands({});
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Query ?brand= ↔ brand_id; mặc định hãng đầu trong danh sách API */
  useEffect(() => {
    if (!brands.length) return;
    const resolved = resolveBrandParam(brandParam, slugToBrandId, brands);
    const order = buildDisplayOrderBrandIds(brands, slugToBrandId);
    if (resolved) {
      setSelectedBrandId(resolved);
      return;
    }
    const first = order[0] || "";
    setSelectedBrandId(first);
    if (first) {
      const b = brands.find((x) => String(x.brand_id) === first);
      if (b) {
        setSearchParams(
          (prev) => {
            const n = new URLSearchParams(prev);
            n.set("brand", brandToUrlSlug(b));
            return n;
          },
          { replace: true }
        );
      }
    }
  }, [brands, slugToBrandId, brandParam, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiGet("/categories/tree");
        if (!cancelled) setCategoryTree(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setCategoryTree([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sidebarRows = useMemo(() => {
    if (!categoryTree.length) {
      return SIDEBAR_ITEMS.map((label) => ({ label, root: null }));
    }
    return SIDEBAR_ITEMS.map((label, idx) => {
      const byName = categoryTree.find((r) => r.category_name?.trim() === label);
      if (byName) return { label, root: byName };
      const byIndex = categoryTree[idx];
      return { label, root: byIndex || null };
    });
  }, [categoryTree]);

  function clearSidebarLeaveTimer() {
    if (sidebarLeaveTimer.current) {
      window.clearTimeout(sidebarLeaveTimer.current);
      sidebarLeaveTimer.current = null;
    }
  }

  useEffect(() => () => clearSidebarLeaveTimer(), []);

  function handleSidebarMegaEnter() {
    clearSidebarLeaveTimer();
  }

  function handleSidebarMegaLeave() {
    clearSidebarLeaveTimer();
    sidebarLeaveTimer.current = window.setTimeout(() => {
      setSidebarMegaOpen(false);
      setActiveSidebarRootId(null);
    }, 200);
  }

  function handleSidebarRowEnter(root) {
    clearSidebarLeaveTimer();
    setSidebarMegaOpen(true);
    setActiveSidebarRootId(root?.category_id ?? null);
  }

  const activeSidebarRoot =
    sidebarRows.find(
      (row) => row.root && String(row.root.category_id) === String(activeSidebarRootId)
    )?.root || null;
  const sidebarSubItems = activeSidebarRoot?.children || [];
  const sidebarMegaColumns = splitIntoColumns(sidebarSubItems, MEGA_COLS);

  const displayOrderIds = useMemo(
    () => buildDisplayOrderBrandIds(brands, slugToBrandId),
    [brands, slugToBrandId]
  );

  /** Khi mở mega sidebar + đang hover nhóm: chỉ chip thương hiệu đã tick trong Admin */
  const visibleBrandIds = useMemo(() => {
    const filterByRoot = Boolean(sidebarMegaOpen && activeSidebarRootId);
    return orderedBrandIdsForRoot(byRootBrands, activeSidebarRootId, filterByRoot, displayOrderIds);
  }, [sidebarMegaOpen, activeSidebarRootId, byRootBrands, displayOrderIds]);

  useEffect(() => {
    if (!visibleBrandIds.length || !selectedBrandId) return;
    if (visibleBrandIds.includes(String(selectedBrandId))) return;
    const next = visibleBrandIds[0];
    setSelectedBrandId(next);
    const b = brands.find((x) => String(x.brand_id) === String(next));
    if (b) {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.set("brand", brandToUrlSlug(b));
          return n;
        },
        { replace: true }
      );
    }
  }, [visibleBrandIds, selectedBrandId, brands, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    setLoadCarousel(true);
    setCarouselErr("");
    const params =
      tab === "bestseller"
        ? { status: "active", limit: 24, is_bestseller: "true" }
        : { status: "active", limit: 24, is_new: "true" };
    (async () => {
      try {
        const data = await apiGet("/products", params);
        if (cancelled) return;
        const items = (data.items || []).map(mapApiProductToCard);
        setCarouselProducts(items);
      } catch (e) {
        if (!cancelled) {
          setCarouselErr(e.message || "Không tải được carousel");
          setCarouselProducts([]);
        }
      } finally {
        if (!cancelled) setLoadCarousel(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  useEffect(() => {
    let cancelled = false;
    setLoadGrid(true);
    setGridErr("");
    if (!selectedBrandId) {
      setGridProducts([]);
      setLoadGrid(false);
      return undefined;
    }
    (async () => {
      try {
        const data = await apiGet("/products", {
          status: "active",
          brand_id: selectedBrandId,
          limit: 100
        });
        if (cancelled) return;
        setGridProducts((data.items || []).map(mapApiProductToCard));
      } catch (e) {
        if (!cancelled) {
          setGridErr(e.message || "Không tải được lưới sản phẩm");
          setGridProducts([]);
        }
      } finally {
        if (!cancelled) setLoadGrid(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedBrandId]);

  useEffect(() => {
    let cancelled = false;
    setLoadPromoBlocks(true);
    (async () => {
      try {
        const [feat, flash] = await Promise.all([
          apiGet("/products", { status: "active", limit: 8, is_featured: "true" }),
          apiGet("/products", { status: "active", limit: 24, flash_sale_active: "true" })
        ]);
        if (cancelled) return;
        setFeaturedRaw(Array.isArray(feat.items) ? feat.items : []);
        setFlashProducts((flash.items || []).map(mapApiProductToCard));
      } catch {
        if (!cancelled) {
          setFeaturedRaw([]);
          setFlashProducts([]);
        }
      } finally {
        if (!cancelled) setLoadPromoBlocks(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function selectBrand(idStr) {
    const id = String(idStr);
    setSelectedBrandId(id);
    const b = brands.find((x) => String(x.brand_id) === id);
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.set("brand", b ? brandToUrlSlug(b) : id);
        return n;
      },
      { replace: true }
    );
  }

  function scrollCarousel(dir) {
    const el = carouselRef.current;
    if (!el) return;
    const delta = Math.min(el.clientWidth * 0.85, 900);
    el.scrollBy({ left: dir * delta, behavior: "smooth" });
  }

  const brandMapped = Boolean(selectedBrandId);

  return (
    <div className="home">
      <div className="home__hero container" id="products">
        <div
          className="home__sidebar-mega"
          onMouseEnter={handleSidebarMegaEnter}
          onMouseLeave={handleSidebarMegaLeave}
        >
          <aside className="home__sidebar" aria-label="Danh mục">
            <ul className="home__sidebar-list">
              {sidebarRows.map(({ label, root }) => {
                const activeMega =
                  sidebarMegaOpen &&
                  root &&
                  String(activeSidebarRootId) === String(root.category_id);
                return (
                  <li
                    key={label}
                    className={`home__sidebar-row ${activeMega ? "home__sidebar-row--mega-active" : ""}`}
                  >
                    <button
                      type="button"
                      className="home__sidebar-btn"
                      onMouseEnter={() => handleSidebarRowEnter(root)}
                    >
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
          {sidebarMegaOpen ? (
            <div className="home__mega-flyout" role="region" aria-label="Danh mục con">
              <div className="cat-nav__mega-panel home__mega-flyout-panel">
                {!activeSidebarRoot ? (
                  <p className="cat-nav__mega-empty">Đang cập nhật danh mục.</p>
                ) : sidebarSubItems.length === 0 ? (
                  <p className="cat-nav__mega-empty">Đang cập nhật danh mục con.</p>
                ) : (
                  <div className="cat-nav__mega-cols">
                    {sidebarMegaColumns.map((col, ci) => (
                      <ul key={ci} className="cat-nav__mega-col">
                        {col.map((child) => (
                          <li key={child.category_id}>
                            <Link
                              className="cat-nav__mega-link"
                              to={`/san-pham?category_id=${child.category_id}`}
                              onClick={() => {
                                setSidebarMegaOpen(false);
                                setActiveSidebarRootId(null);
                              }}
                            >
                              {child.category_name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div
          className="home__hero-showcase"
          onMouseEnter={() => setHeroPaused(true)}
          onMouseLeave={() => setHeroPaused(false)}
        >
          <section className="home__banner-main" aria-label="Banner chính">
            <div
              className="home__hero-carousel home__banner-card home__banner-card--large home__banner-card--wood"
              role="region"
              aria-roledescription="carousel"
              aria-label={`Bộ ảnh theo hãng — ${currentHero?.brand?.label ?? ""}`}
              aria-live="polite"
            >
              <span className="home__hero-brand-tag">{currentHero?.brand?.label}</span>
              {main ? (
                <div
                  key={currentHero.key}
                  className="home__hero-slide home__hero-slide--active home__hero-slide--enter"
                >
                  <img
                    src={main.image}
                    alt=""
                    className="home__banner-img home__banner-img--hero"
                    loading="lazy"
                  />
                  <div className="home__banner-deWalt" aria-hidden>
                    {main.brand}
                  </div>
                  <div className="home__banner-overlay">
                    <p className="home__banner-kicker">{main.kicker}</p>
                    <h2 className="home__banner-title">{main.title}</h2>
                    <p className="home__banner-price">{main.price}</p>
                    <div className="home__banner-badges" aria-hidden>
                      {(main.badges || []).map((b, idx) => (
                        <span
                          key={b}
                          className={`home__banner-badge-chip ${idx === (main.badges?.length ?? 0) - 1 ? "home__banner-badge-chip--xr" : ""}`}
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
              <button
                type="button"
                className="home__hero-nav home__hero-nav--prev"
                aria-label="Bộ ảnh trước"
                onClick={() => goHero(-1)}
              />
              <button
                type="button"
                className="home__hero-nav home__hero-nav--next"
                aria-label="Bộ ảnh sau"
                onClick={() => goHero(1)}
              />
              <div className="home__hero-dots" role="tablist" aria-label="Chọn bộ ảnh">
                {heroSequence.map((item, i) => (
                  <button
                    key={item.key}
                    type="button"
                    role="tab"
                    aria-selected={i === safeHeroIndex}
                    className={`home__hero-dot ${i === safeHeroIndex ? "home__hero-dot--active" : ""}`}
                    onClick={() => setHeroFlatIndex(i)}
                    aria-label={`${item.brand.label} — ${i + 1}/${heroFlatLen}`}
                  />
                ))}
              </div>
            </div>
          </section>

          <div className="home__banners-side">
            {side1 ? (
              <div key={`${currentHero.key}-s1`} className="home__banner-card home__banner-card--small home__banner-card--enter">
                <img src={side1.image} alt="" className="home__banner-img" />
                <div className="home__banner-overlay home__banner-overlay--compact">
                  <span className="home__banner-kicker">{side1.kicker}</span>
                  <span className="home__banner-title home__banner-title--sm">{side1.title}</span>
                  {side1.price ? (
                    <span className="home__banner-price home__banner-price--side">{side1.price}</span>
                  ) : null}
                </div>
              </div>
            ) : null}
            {side2 ? (
              <div key={`${currentHero.key}-s2`} className="home__banner-card home__banner-card--small home__banner-card--enter">
                <img src={side2.image} alt="" className="home__banner-img" />
                <div className="home__banner-overlay home__banner-overlay--compact">
                  {side2.price ? (
                    <>
                      {side2.kicker ? (
                        <span className="home__banner-kicker">{side2.kicker}</span>
                      ) : null}
                      {side2.title ? (
                        <span className="home__banner-title home__banner-title--sm">{side2.title}</span>
                      ) : null}
                      <span className="home__banner-price home__banner-price--side">{side2.price}</span>
                    </>
                  ) : (
                    <span className="home__banner-warranty">{side2.warranty}</span>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {!loadPromoBlocks && featuredRaw.length > 0 ? <HomeFeaturedPromo products={featuredRaw} /> : null}

      {!loadPromoBlocks && flashProducts.length > 0 ? (
        <section className="home__flash" aria-labelledby="home-flash-heading">
          <div className="container home__flash-inner">
            <h2 id="home-flash-heading" className="home__flash-title">
              <span className="home__flash-icon" aria-hidden />
              Flash sale
            </h2>
            <p className="home__flash-sub">Giá siêu tốc trong khung giờ — kéo ngang để xem thêm.</p>
            <div className="home__flash-scroll">
              {flashProducts.map((p) => (
                <div key={p.id} className="home__flash-item">
                  <ProductCard product={p} compact />
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="home__featured" aria-labelledby="featured-heading">
        <div className="home__featured-inner container">
          <h2 id="featured-heading" className="visually-hidden">
            Sản phẩm nổi bật theo tab
          </h2>
          <div className="home__tabs" role="tablist">
            <div className="home__tab-led">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "bestseller"}
                className={`home__tab ${tab === "bestseller" ? "home__tab--active" : "home__tab--inactive"}`}
                onClick={() => setTab("bestseller")}
              >
                SẢN PHẨM BÁN CHẠY
              </button>
            </div>
            <div className="home__tab-led">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "new"}
                className={`home__tab ${tab === "new" ? "home__tab--active" : "home__tab--inactive"}`}
                onClick={() => setTab("new")}
              >
                SẢN PHẨM MỚI
              </button>
            </div>
          </div>

          <div className="home__carousel-wrap">
            <button
              type="button"
              className="home__carousel-arrow home__carousel-arrow--prev"
              aria-label="Xem sản phẩm trước"
              onClick={() => scrollCarousel(-1)}
            >
              ‹
            </button>
            <div className="home__carousel" ref={carouselRef} tabIndex={0}>
              {loadCarousel ? (
                <p className="home__empty-msg" style={{ padding: "1rem" }}>
                  Đang tải sản phẩm…
                </p>
              ) : carouselErr ? (
                <p className="home__empty-msg" role="alert">
                  Không tải được danh sách. Vui lòng thử lại sau.
                </p>
              ) : carouselProducts.length === 0 ? (
                <p className="home__empty-msg">Hiện chưa có sản phẩm.</p>
              ) : (
                carouselProducts.map((p) => (
                  <div key={p.id} className="home__carousel-item">
                    <ProductCard product={p} compact />
                  </div>
                ))
              )}
            </div>
            <button
              type="button"
              className="home__carousel-arrow home__carousel-arrow--next"
              aria-label="Xem sản phẩm sau"
              onClick={() => scrollCarousel(1)}
            >
              ›
            </button>
          </div>
        </div>
      </section>

      <section className="home__brand-section" id="warranty">
        <div className="container">
          <h2 className="home__brand-title">
            <span className="home__brand-accent" aria-hidden />
            Thương Hiệu
          </h2>

          <div className="home__brand-filters-led" role="presentation">
            <div className="home__brand-filters" role="tablist" aria-label="Lọc theo thương hiệu">
              {visibleBrandIds.map((bid) => {
                const b = brands.find((x) => String(x.brand_id) === String(bid));
                if (!b) return null;
                const active = String(selectedBrandId) === String(bid);
                return (
                  <button
                    key={bid}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`home__brand-chip ${active ? "home__brand-chip--active home__brand-chip--glow" : ""}`}
                    onClick={() => selectBrand(bid)}
                  >
                    {b.brand_name}
                  </button>
                );
              })}
            </div>
          </div>

          {!brandMapped ? (
            <p className="home__empty-msg" role="status">
              Hiện chưa có sản phẩm.
            </p>
          ) : loadGrid ? (
            <p className="home__empty-msg">Đang tải…</p>
          ) : gridErr ? (
            <p className="home__empty-msg" role="alert">
              Không tải được danh sách. Vui lòng thử lại sau.
            </p>
          ) : gridProducts.length === 0 ? (
            <p className="home__empty-msg">Hiện chưa có sản phẩm.</p>
          ) : (
            <ul className="home__product-grid home__product-grid--tight">
              {gridProducts.map((p) => (
                <li key={p.id}>
                  <ProductCard product={p} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <HomeRecommendations />
      <RecentlyViewedStrip />
    </div>
  );
}
