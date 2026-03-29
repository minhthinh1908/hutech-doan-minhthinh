import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getRecentlyViewedSnapshots } from "../utils/recentlyViewed.js";
import ProductCard from "./ProductCard.jsx";
import "./RecentlyViewedStrip.css";

export default function RecentlyViewedStrip() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    function load() {
      setItems(getRecentlyViewedSnapshots());
    }
    load();
    window.addEventListener("bd-recent-updated", load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener("bd-recent-updated", load);
      window.removeEventListener("storage", load);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="recent-strip" aria-labelledby="recent-h">
      <div className="container">
        <h2 id="recent-h" className="recent-strip__title">
          <span className="recent-strip__accent" aria-hidden />
          Đã xem gần đây
        </h2>
        <ul className="recent-strip__grid">
          {items.map((snap) => (
            <li key={snap.id}>
              <ProductCard
                product={{
                  id: snap.id,
                  name: snap.name,
                  price: snap.price,
                  oldPrice: null,
                  discount: null,
                  hot: false,
                  contactOnly: !snap.price,
                  image: snap.image
                }}
                compact
              />
            </li>
          ))}
        </ul>
        <p className="recent-strip__hint">
          <Link to="/san-pham">Xem tất cả sản phẩm →</Link>
        </p>
      </div>
    </section>
  );
}
