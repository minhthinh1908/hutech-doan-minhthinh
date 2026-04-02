import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../api/client.js";
import { slugifyTitle } from "../utils/slugify.js";

function PolicyLink({ item }) {
  if (!item?.label) return null;
  if (item.href && String(item.href).trim()) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" className="site-footer__policy-link">
        {item.label}
      </a>
    );
  }
  const internalTo = item.to || (slugifyTitle(item.label) ? `/${slugifyTitle(item.label)}` : "");
  if (internalTo) {
    return (
      <Link to={internalTo} className="site-footer__policy-link">
        {item.label}
      </Link>
    );
  }
  return <span className="site-footer__policy-text">{item.label}</span>;
}

export default function SiteFooter() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const row = await apiGet("/site-footer");
        if (!cancelled) setData(row);
      } catch (e) {
        if (!cancelled) setErr(e.message || "Không tải được chân trang");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const policies = Array.isArray(data?.policies_json) ? data.policies_json : [];

  return (
    <footer className="site-footer">
      <div className="site-footer__main">
        <div className="container site-footer__grid">
          <div className="site-footer__col site-footer__col--brand">
            <h2 className="site-footer__brand">{data?.site_name || "E-COMMERCE TOOLS"}</h2>

            {data?.branch1_label || data?.branch1_phone || data?.branch1_address ? (
              <div className="site-footer__block">
                {data.branch1_label ? <p className="site-footer__label">{data.branch1_label}</p> : null}
                {data.branch1_phone ? (
                  <p className="site-footer__line">
                    <span className="site-footer__k">Hotline:</span> {data.branch1_phone}
                  </p>
                ) : null}
                {data.branch1_address ? <p className="site-footer__addr">{data.branch1_address}</p> : null}
              </div>
            ) : null}

            {data?.branch2_label || data?.branch2_phone || data?.branch2_address ? (
              <div className="site-footer__block">
                {data.branch2_label ? <p className="site-footer__label">{data.branch2_label}</p> : null}
                {data.branch2_phone ? (
                  <p className="site-footer__line">
                    <span className="site-footer__k">Hotline:</span> {data.branch2_phone}
                  </p>
                ) : null}
                {data.branch2_address ? <p className="site-footer__addr">{data.branch2_address}</p> : null}
              </div>
            ) : null}

            {data?.email ? (
              <p className="site-footer__line">
                <span className="site-footer__k">Email:</span>{" "}
                <a href={`mailto:${data.email}`} className="site-footer__inline-link">
                  {data.email}
                </a>
              </p>
            ) : null}
            {data?.website_url ? (
              <p className="site-footer__line">
                <span className="site-footer__k">Website:</span>{" "}
                <a href={data.website_url} target="_blank" rel="noopener noreferrer" className="site-footer__inline-link">
                  {data.website_url.replace(/^https?:\/\//, "")}
                </a>
              </p>
            ) : null}

            {err ? (
              <p className="site-footer__warn" role="alert">
                {err}
              </p>
            ) : null}
          </div>

          <div className="site-footer__col site-footer__col--maps">
            {data?.branch1_map_embed_url ? (
              <div className="site-footer__map-wrap">
                {data.branch1_label ? <p className="site-footer__map-title">{data.branch1_label.replace(/:$/, "")}</p> : null}
                <div className="site-footer__map-frame">
                  <iframe
                    title="Bản đồ chi nhánh 1"
                    src={data.branch1_map_embed_url}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                </div>
              </div>
            ) : null}
            {data?.branch2_map_embed_url ? (
              <div className="site-footer__map-wrap">
                {data.branch2_label ? <p className="site-footer__map-title">{data.branch2_label.replace(/:$/, "")}</p> : null}
                <div className="site-footer__map-frame">
                  <iframe
                    title="Bản đồ chi nhánh 2"
                    src={data.branch2_map_embed_url}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                </div>
              </div>
            ) : null}
            {!data?.branch1_map_embed_url && !data?.branch2_map_embed_url && !err ? (
              <p className="site-footer__muted">Bản đồ đang được cập nhật.</p>
            ) : null}
          </div>

          <div className="site-footer__col site-footer__col--policies">
            <h3 className="site-footer__heading">CHÍNH SÁCH</h3>
            <ul className="site-footer__policy-list">
              {policies.map((item, i) => (
                <li key={`${item.label}-${i}`}>
                  <PolicyLink item={item} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="site-footer__bottom">
        <div className="container site-footer__bottom-inner">
          <p className="site-footer__copy">
            {data?.copyright_line ||
              `© ${new Date().getFullYear()} ${data?.site_name || "E-COMMERCE TOOLS"}`}
          </p>
        </div>
      </div>
    </footer>
  );
}
