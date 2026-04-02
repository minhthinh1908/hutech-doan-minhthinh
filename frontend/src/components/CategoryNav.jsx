import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { apiGet } from "../api/client.js";
import { MEGA_COLS, splitIntoColumns } from "../utils/categoryMega.js";
import { brandToUrlSlug, resolveBrandParam } from "../utils/brandSlug.js";
import {
  abbrForBrandName,
  buildDisplayOrderBrandIds,
  buildSlugToBrandIdFromList,
  orderedBrandIdsForRoot
} from "../utils/brandByCategory.js";
import { getBrandAccentKey } from "../utils/brandAccent.js";

function IconGrid() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z" />
    </svg>
  );
}

export default function CategoryNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [megaOpen, setMegaOpen] = useState(false);
  const [activeRootId, setActiveRootId] = useState(null);
  const leaveTimer = useRef(null);

  const [brands, setBrands] = useState([]);
  const [byRoot, setByRoot] = useState({});
  const [slugToBrandId, setSlugToBrandId] = useState({});

  const loadTree = useCallback(async () => {
    try {
      const data = await apiGet("/categories/tree");
      setTree(Array.isArray(data) ? data : []);
    } catch {
      setTree([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBrandLinks = useCallback(async () => {
    try {
      const data = await apiGet("/category-brands");
      setByRoot(data?.by_root && typeof data.by_root === "object" ? data.by_root : {});
      const list = Array.isArray(data?.brands) ? data.brands : [];
      setBrands(list);
      setSlugToBrandId(buildSlugToBrandIdFromList(list));
    } catch {
      setBrands([]);
      setByRoot({});
      setSlugToBrandId({});
    }
  }, []);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  useEffect(() => {
    loadBrandLinks();
  }, [loadBrandLinks]);

  useEffect(() => {
    if (!megaOpen || !tree.length) return;
    setActiveRootId((prev) => {
      if (prev != null && tree.some((r) => String(r.category_id) === String(prev))) return prev;
      return tree[0].category_id;
    });
  }, [tree, megaOpen]);

  const displayOrderIds = useMemo(
    () => buildDisplayOrderBrandIds(brands, slugToBrandId),
    [brands, slugToBrandId]
  );

  const visibleBrandIds = useMemo(
    () => orderedBrandIdsForRoot(byRoot, activeRootId, megaOpen, displayOrderIds),
    [byRoot, activeRootId, megaOpen, displayOrderIds]
  );

  const visibleNavBrands = useMemo(() => {
    const byId = new Map(brands.map((b) => [String(b.brand_id), b]));
    return visibleBrandIds
      .map((id) => {
        const b = byId.get(String(id));
        if (!b) return null;
        return {
          slug: brandToUrlSlug(b),
          name: b.brand_name,
          abbr: abbrForBrandName(b.brand_name),
          brandId: String(b.brand_id)
        };
      })
      .filter(Boolean);
  }, [visibleBrandIds, brands]);

  const activeHomeBrandId =
    location.pathname === "/" ? resolveBrandParam(searchParams.get("brand"), slugToBrandId, brands) : null;

  function clearLeaveTimer() {
    if (leaveTimer.current) {
      window.clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  }

  function handleEnterMega() {
    clearLeaveTimer();
    setMegaOpen(true);
    if (tree.length) {
      setActiveRootId(tree[0].category_id);
    }
  }

  function handleLeaveMega() {
    clearLeaveTimer();
    leaveTimer.current = window.setTimeout(() => {
      setMegaOpen(false);
      setActiveRootId(null);
    }, 200);
  }

  const activeRoot = tree.find((r) => String(r.category_id) === String(activeRootId)) || tree[0];
  const subItems = activeRoot?.children || [];
  const columns = splitIntoColumns(subItems, MEGA_COLS);

  return (
    <div className="cat-nav">
      <div className="cat-nav__inner container">
        <div className="cat-nav__mega" onMouseEnter={handleEnterMega} onMouseLeave={handleLeaveMega}>
          <button type="button" className="cat-nav__trigger" aria-expanded={megaOpen} aria-haspopup="true">
            <IconGrid />
            <span>DANH MỤC SẢN PHẨM</span>
          </button>

          {megaOpen && !loading && tree.length > 0 ? (
            <div className="cat-nav__dropdown" role="region" aria-label="Danh mục sản phẩm">
              <div className="cat-nav__mega-sidebar">
                {tree.map((root) => {
                  const id = root.category_id;
                  const active = String(activeRootId) === String(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`cat-nav__mega-parent ${active ? "cat-nav__mega-parent--active" : ""}`}
                      aria-current={active ? "true" : undefined}
                      onMouseEnter={() => setActiveRootId(id)}
                    >
                      <span className="cat-nav__mega-dash" aria-hidden />
                      {root.category_name}
                    </button>
                  );
                })}
              </div>
              <div className="cat-nav__mega-panel">
                {subItems.length === 0 ? (
                  <p className="cat-nav__mega-empty">Đang cập nhật danh mục con.</p>
                ) : (
                  <div className="cat-nav__mega-cols">
                    {columns.map((col, ci) => (
                      <ul key={ci} className="cat-nav__mega-col">
                        {col.map((child) => (
                          <li key={child.category_id}>
                            <Link
                              className="cat-nav__mega-link"
                              to={`/san-pham?category_id=${child.category_id}`}
                              onClick={() => setMegaOpen(false)}
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
          {megaOpen && !loading && tree.length === 0 ? (
            <div className="cat-nav__dropdown cat-nav__dropdown--solo" role="status">
              <p className="cat-nav__mega-empty">Đang cập nhật danh mục.</p>
            </div>
          ) : null}
        </div>

        <div className="cat-nav__brands-led-wrap" aria-label="Khu thương hiệu">
          <div className="cat-nav__brands">
            <span className="cat-nav__brands-label">THƯƠNG HIỆU</span>
            <ul className="cat-nav__brand-list">
              {visibleNavBrands.map((b) => {
                const isActive =
                  activeHomeBrandId != null && String(activeHomeBrandId) === String(b.brandId);
                const accent = getBrandAccentKey(b.name);
                return (
                  <li key={b.brandId}>
                    <button
                      type="button"
                      className={`cat-nav__brand cat-nav__brand--led cat-nav__brand--accent-${accent} ${isActive ? "cat-nav__brand--active" : ""}`}
                      title={b.name}
                      onClick={() => navigate(`/?brand=${encodeURIComponent(b.slug)}`)}
                    >
                      <span className={`cat-nav__brand-inner ${isActive ? "cat-nav__brand-inner--active" : ""}`}>
                        <span className="cat-nav__brand-abbr">{b.abbr}</span>
                        <span className="cat-nav__brand-name">{b.name}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
