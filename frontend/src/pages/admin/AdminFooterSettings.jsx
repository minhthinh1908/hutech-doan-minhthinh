import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPatch } from "../../api/client.js";
import "./AdminPages.css";

const emptyPolicy = () => ({ label: "", to: "", href: "" });

export default function AdminFooterSettings() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    site_name: "",
    branch1_label: "",
    branch1_phone: "",
    branch1_address: "",
    branch1_map_embed_url: "",
    branch2_label: "",
    branch2_phone: "",
    branch2_address: "",
    branch2_map_embed_url: "",
    email: "",
    website_url: "",
    copyright_line: ""
  });
  const [policies, setPolicies] = useState([emptyPolicy()]);

  const load = useCallback(async () => {
    setErr("");
    const row = await apiGet("/site-footer");
    setForm({
      site_name: row.site_name || "",
      branch1_label: row.branch1_label || "",
      branch1_phone: row.branch1_phone || "",
      branch1_address: row.branch1_address || "",
      branch1_map_embed_url: row.branch1_map_embed_url || "",
      branch2_label: row.branch2_label || "",
      branch2_phone: row.branch2_phone || "",
      branch2_address: row.branch2_address || "",
      branch2_map_embed_url: row.branch2_map_embed_url || "",
      email: row.email || "",
      website_url: row.website_url || "",
      copyright_line: row.copyright_line || ""
    });
    const p = Array.isArray(row.policies_json) && row.policies_json.length ? row.policies_json : [emptyPolicy()];
    setPolicies(
      p.map((x) => ({
        label: x.label || "",
        to: x.to || "",
        href: x.href || ""
      }))
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load();
      } catch (e) {
        if (!cancelled) setErr(e.message || "Không tải được");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    const policies_json = policies
      .filter((x) => x.label.trim())
      .map((x) => {
        const o = { label: x.label.trim() };
        if (x.to.trim()) o.to = x.to.trim();
        if (x.href.trim()) o.href = x.href.trim();
        return o;
      });
    try {
      await apiPatch(
        "/admin/site-footer",
        {
          ...form,
          policies_json
        },
        { auth: true }
      );
      setMsg("Đã lưu chân trang. Khách xem ngay trên website.");
      await load();
    } catch (e) {
      setErr(e.message || "Lưu thất bại");
    }
  }

  function updatePolicy(i, field, value) {
    setPolicies((list) => list.map((row, j) => (j === i ? { ...row, [field]: value } : row)));
  }

  function addPolicyRow() {
    setPolicies((list) => [...list, emptyPolicy()]);
  }

  function removePolicyRow(i) {
    setPolicies((list) => list.filter((_, j) => j !== i));
  }

  if (loading) {
    return (
      <div className="admin-page">
        <p>Đang tải…</p>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <h1>Chân trang & bản đồ</h1>
      <p className="admin-page__muted">
        Nội dung hiển thị ở cuối mọi trang (tên shop, chi nhánh, email, Google Maps nhúng, liên kết chính sách). URL bản đồ: Google
        Maps → Chia sẻ → Nhúng bản đồ → copy chỉ phần <code>src=&quot;…&quot;</code> (https://www.google.com/maps/embed?…).
      </p>
      {err ? (
        <p className="admin-msg admin-msg--err" role="alert">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="admin-msg admin-msg--ok" role="status">
          {msg}
        </p>
      ) : null}

      <form className="admin-form admin-form--wide" style={{ maxWidth: "820px" }} onSubmit={submit}>
        <label>
          Tên hiển thị (logo chữ)
          <input
            value={form.site_name}
            onChange={(e) => setForm((f) => ({ ...f, site_name: e.target.value }))}
            required
          />
        </label>

        <h2 className="admin-page__muted" style={{ margin: "1rem 0 0", fontSize: "1rem" }}>
          Chi nhánh 1
        </h2>
        <div className="admin-form__row">
          <label>
            Nhãn (vd. Chi nhánh Bình Định:)
            <input
              value={form.branch1_label}
              onChange={(e) => setForm((f) => ({ ...f, branch1_label: e.target.value }))}
            />
          </label>
          <label>
            Hotline
            <input
              value={form.branch1_phone}
              onChange={(e) => setForm((f) => ({ ...f, branch1_phone: e.target.value }))}
            />
          </label>
        </div>
        <label>
          Địa chỉ
          <textarea
            rows={2}
            value={form.branch1_address}
            onChange={(e) => setForm((f) => ({ ...f, branch1_address: e.target.value }))}
          />
        </label>
        <label>
          URL nhúng Google Maps (iframe src)
          <textarea
            rows={2}
            placeholder="https://www.google.com/maps/embed?pb=..."
            value={form.branch1_map_embed_url}
            onChange={(e) => setForm((f) => ({ ...f, branch1_map_embed_url: e.target.value }))}
          />
        </label>

        <h2 className="admin-page__muted" style={{ margin: "1rem 0 0", fontSize: "1rem" }}>
          Chi nhánh 2
        </h2>
        <div className="admin-form__row">
          <label>
            Nhãn (vd. Chi nhánh HCM:)
            <input
              value={form.branch2_label}
              onChange={(e) => setForm((f) => ({ ...f, branch2_label: e.target.value }))}
            />
          </label>
          <label>
            Hotline
            <input
              value={form.branch2_phone}
              onChange={(e) => setForm((f) => ({ ...f, branch2_phone: e.target.value }))}
            />
          </label>
        </div>
        <label>
          Địa chỉ
          <textarea
            rows={2}
            value={form.branch2_address}
            onChange={(e) => setForm((f) => ({ ...f, branch2_address: e.target.value }))}
          />
        </label>
        <label>
          URL nhúng Google Maps (iframe src)
          <textarea
            rows={2}
            placeholder="https://www.google.com/maps/embed?pb=..."
            value={form.branch2_map_embed_url}
            onChange={(e) => setForm((f) => ({ ...f, branch2_map_embed_url: e.target.value }))}
          />
        </label>

        <div className="admin-form__row">
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </label>
          <label>
            Website (đầy đủ https://…)
            <input
              type="url"
              value={form.website_url}
              onChange={(e) => setForm((f) => ({ ...f, website_url: e.target.value }))}
            />
          </label>
        </div>
        <label>
          Dòng bản quyền (tuỳ chọn)
          <input
            value={form.copyright_line}
            onChange={(e) => setForm((f) => ({ ...f, copyright_line: e.target.value }))}
            placeholder={`© ${new Date().getFullYear()} BÌNH ĐỊNH TOOLS`}
          />
        </label>

        <h2 className="admin-page__muted" style={{ margin: "1rem 0 0", fontSize: "1rem" }}>
          Liên kết chính sách
        </h2>
        <p className="admin-page__muted" style={{ margin: "0 0 0.5rem" }}>
          «Đường dẫn trong site» (vd. /lien-he) hoặc «Link ngoài» (https://…) — ưu tiên link ngoài nếu điền cả hai.
        </p>
        {policies.map((row, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gap: "0.5rem",
              borderBottom: "1px solid #eee",
              paddingBottom: "0.75rem",
              marginBottom: "0.5rem"
            }}
          >
            <label>
              Tiêu đề
              <input value={row.label} onChange={(e) => updatePolicy(i, "label", e.target.value)} placeholder="Hướng dẫn mua hàng" />
            </label>
            <div className="admin-form__row">
              <label>
                Đường dẫn (trong site)
                <input value={row.to} onChange={(e) => updatePolicy(i, "to", e.target.value)} placeholder="/gioi-thieu" />
              </label>
              <label>
                Hoặc link ngoài
                <input value={row.href} onChange={(e) => updatePolicy(i, "href", e.target.value)} placeholder="https://..." />
              </label>
            </div>
            {policies.length > 1 ? (
              <button type="button" className="admin-btn admin-btn--danger" style={{ padding: "0.35rem 0.5rem", maxWidth: "8rem" }} onClick={() => removePolicyRow(i)}>
                Xóa dòng
              </button>
            ) : null}
          </div>
        ))}
        <div>
          <button type="button" className="admin-btn" style={{ background: "#555" }} onClick={addPolicyRow}>
            + Thêm liên kết
          </button>
        </div>

        <div style={{ marginTop: "1rem" }}>
          <button type="submit" className="admin-btn">
            Lưu chân trang
          </button>
        </div>
      </form>
    </div>
  );
}
