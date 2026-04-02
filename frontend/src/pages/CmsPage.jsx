import { useEffect, useState } from "react";
import DOMPurify from "dompurify";
import { useParams } from "react-router-dom";
import { apiGet } from "../api/client.js";
import StaticPage from "./StaticPage.jsx";

export default function CmsPage({ slug, fallbackTitle }) {
  const { slug: routeSlug } = useParams();
  const finalSlug = String(slug || routeSlug || "").trim();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const d = await apiGet(`/cms-pages/${finalSlug}`);
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled) setErr(e.message || "Không tải được");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [finalSlug]);

  const autoTitle = finalSlug ? finalSlug.replace(/-/g, " ") : "";
  const title = data?.title?.trim() || fallbackTitle || autoTitle;

  if (loading) {
    return (
      <StaticPage title={fallbackTitle || "Nội dung"}>
        Đang tải nội dung…
      </StaticPage>
    );
  }

  if (err || !data) {
    return (
      <StaticPage title={title || "Nội dung"}>
        {err || "Chưa có nội dung. Vui lòng quay lại sau hoặc liên hệ hotline."}
      </StaticPage>
    );
  }

  const safe = DOMPurify.sanitize(data.body_html || "", { USE_PROFILES: { html: true } });
  if (!String(safe).trim()) {
    return (
      <StaticPage title={title}>
        Nội dung trang đang được cập nhật. Vui lòng quay lại sau hoặc liên hệ hotline.
      </StaticPage>
    );
  }

  return <StaticPage title={title} htmlContent={safe} />;
}
