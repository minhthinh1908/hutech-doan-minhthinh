import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { apiGet } from "../api/client.js";
import { mapApiProductToCard } from "../utils/mapProduct.js";
import { DEMO_PRODUCTS } from "../data/demoProducts.js";
import ProductCard from "../components/ProductCard.jsx";
import { CoreBadge, CoreMessage, CoreSelect, CoreSpinner } from "../components/ui/index.js";

export default function ProductBrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") || "";
  const sort = searchParams.get("sort") || "";
  const categoryId = searchParams.get("category_id") || "";
  const page = Number(searchParams.get("page")) || 1;

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [usedDemo, setUsedDemo] = useState(false);

  const queryKey = useMemo(() => `${q}|${sort}|${page}`, [q, sort, page]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError("");
      try {
        const data = await apiGet("/products", {
          q: q || undefined,
          sort: sort || undefined,
          category_id: categoryId || undefined,
          page,
          limit: 12,
          status: "active"
        });
        if (cancelled) return;
        const mapped = (data.items || []).map(mapApiProductToCard);
        setItems(mapped);
        setTotal(data.total ?? mapped.length);
        setUsedDemo(false);
      } catch (e) {
        if (cancelled) return;
        let list = [...DEMO_PRODUCTS];
        if (q.trim()) {
          const lower = q.toLowerCase();
          list = list.filter(
            (p) =>
              p.name.toLowerCase().includes(lower) || String(p.id).includes(lower)
          );
        }
        setItems(list.map((p) => ({ ...p, id: String(p.id) })));
        setTotal(list.length);
        setUsedDemo(true);
        setError("Không kết nối được API — đang hiển thị dữ liệu demo.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [queryKey, q, sort, categoryId, page]);

  function setSort(next) {
    const p = new URLSearchParams(searchParams);
    if (next) p.set("sort", next);
    else p.delete("sort");
    p.set("page", "1");
    setSearchParams(p);
  }

  return (
    <div className="browse-page">
      <div className="browse-page__hero">
        <div className="container">
          <h1 className="browse-page__title">Sản phẩm</h1>
          <p className="browse-page__lead">
            Tìm kiếm &amp; duyệt máy móc cầm tay — {q ? `“${q}”` : "toàn bộ danh mục"}.
          </p>
        </div>
      </div>

      <div className="container browse-page__toolbar">
        <div className="browse-page__sort">
          <CoreSelect
            label="Sắp xếp"
            value={sort}
            onChange={(e) => setSort(e.value || "")}
            options={[
              { label: "Mặc định", value: "" },
              { label: "Giá tăng dần", value: "price_asc" },
              { label: "Giá giảm dần", value: "price_desc" },
              { label: "Tên A–Z", value: "name_asc" }
            ]}
            filter={false}
          />
        </div>
        {usedDemo ? <CoreBadge value="Demo" tone="warn" /> : null}
      </div>

      {error ? (
        <div className="container browse-page__warn">
          <CoreMessage severity="warn" text={error} />
        </div>
      ) : null}

      {loading ? (
        <div className="browse-page__loading container">
          <CoreSpinner style={{ width: "2.25rem", height: "2.25rem" }} strokeWidth="6" />
        </div>
      ) : (
        <ul className="browse-page__grid container">
          {items.map((p) => (
            <li key={p.id || p.product_id}>
              <ProductCard product={p} />
            </li>
          ))}
        </ul>
      )}

      {!loading && items.length === 0 ? (
        <p className="container browse-page__empty">Không có sản phẩm phù hợp.</p>
      ) : null}

      <p className="container browse-page__meta">
        {total > 0 ? `Tổng ${total} sản phẩm` : null}
        {" · "}
        <Link to="/">Về trang chủ</Link>
      </p>
    </div>
  );
}
