import { useEffect, useState } from "react";
import { apiGet } from "../api/client.js";
import { mapApiProductToCard } from "../utils/mapProduct.js";
import { getRecentlyViewedSnapshots } from "../utils/recentlyViewed.js";
import ProductCard from "./ProductCard.jsx";

export default function HomeRecommendations() {
  const [personal, setPersonal] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadPersonal() {
      const recent = getRecentlyViewedSnapshots();
      const last = recent[0];
      try {
        if (last?.id) {
          const detail = await apiGet(`/products/${last.id}`);
          const bid = detail.brand_id;
          if (bid) {
            const data = await apiGet("/products", {
              status: "active",
              brand_id: bid,
              limit: 12
            });
            if (cancelled) return;
            const mapped = (data.items || [])
              .map(mapApiProductToCard)
              .filter((x) => String(x.id) !== String(last.id))
              .slice(0, 4);
            if (mapped.length) {
              setPersonal(mapped);
              return;
            }
          }
        }
        const fallback = await apiGet("/products", { status: "active", limit: 4 });
        if (cancelled) return;
        setPersonal((fallback.items || []).map(mapApiProductToCard));
      } catch {
        if (cancelled) return;
        try {
          const fallback = await apiGet("/products", { status: "active", limit: 4 });
          if (!cancelled) setPersonal((fallback.items || []).map(mapApiProductToCard));
        } catch {
          if (!cancelled) setPersonal([]);
        }
      }
    }

    async function loadRecommended() {
      try {
        const data = await apiGet("/products", {
          limit: 8,
          status: "active",
          sort: "price_desc"
        });
        if (cancelled) return;
        setRecommended((data.items || []).map(mapApiProductToCard));
      } catch {
        if (!cancelled) setRecommended([]);
      }
    }

    (async () => {
      setLoading(true);
      await Promise.all([loadPersonal(), loadRecommended()]);
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <section className="home-rec home-rec--personal" aria-labelledby="rec-pers">
        <div className="container">
          <h2 id="rec-pers" className="home-rec__title">
            <span className="home-rec__accent" aria-hidden />
            Gợi ý cá nhân hóa
          </h2>
          <p className="home-rec__sub">Dựa trên sản phẩm bạn đã xem (dữ liệu từ cửa hàng).</p>
          {loading ? (
            <p className="home-rec__sub">Đang tải…</p>
          ) : personal.length === 0 ? (
            <p className="home-rec__sub">Chưa có gợi ý — xem thêm sản phẩm trong danh mục.</p>
          ) : (
            <ul className="home-rec__grid">
              {personal.map((p) => (
                <li key={p.id}>
                  <ProductCard product={{ ...p, id: String(p.id) }} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="home-rec" aria-labelledby="rec-gen">
        <div className="container">
          <h2 id="rec-gen" className="home-rec__title">
            <span className="home-rec__accent" aria-hidden />
            Sản phẩm gợi ý
          </h2>
          <p className="home-rec__sub">Một số sản phẩm nổi bật theo mức giá.</p>
          {loading ? (
            <p className="home-rec__sub">Đang tải…</p>
          ) : recommended.length === 0 ? (
            <p className="home-rec__sub">Hiện chưa có sản phẩm.</p>
          ) : (
            <ul className="home-rec__grid">
              {recommended.map((p) => (
                <li key={p.id || p.product_id}>
                  <ProductCard product={p} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
