import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPatch } from "../../api/client.js";
import { CoreButton, CoreCard } from "../../components/ui/index.js";
import useAdminToastNotices from "../../hooks/useAdminToastNotices.js";
import { slugifyTitle } from "../../utils/slugify.js";

const emptyPolicy = () => ({ label: "", to: "", href: "" });

export default function AdminFooterSettings() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  useAdminToastNotices({ err, msg, setErr, setMsg });
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
        if (!cancelled) setErr(e.message || "Không tải được dữ liệu.");
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
        const slug = slugifyTitle(x.label);
        if (slug) o.to = `/${slug}`;
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
      setErr(e.message || "Không lưu được dữ liệu.");
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
        <p>Đang tải dữ liệu…</p>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <h1 className="admin-section-title">Chân trang & bản đồ</h1>
      <p className="admin-lead">
        Nội dung hiển thị ở cuối mọi trang (tên shop, chi nhánh, email, Google Maps nhúng, liên kết chính sách). URL bản đồ: Google
        Maps → Chia sẻ → Nhúng bản đồ → copy chỉ phần <code>src=&quot;…&quot;</code> (https://www.google.com/maps/embed?…).
      </p>
      <CoreCard>
        <form className="space-y-4 max-w-4xl" onSubmit={submit}>
          <label className="block text-sm font-semibold">
          Tên hiển thị (logo chữ)
          <input
            className="admin-form-control w-full mt-1"
            value={form.site_name}
            onChange={(e) => setForm((f) => ({ ...f, site_name: e.target.value }))}
            required
          />
        </label>

        <h2 className="admin-section-title text-base mb-2 mt-4">
          Chi nhánh 1
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="admin-form-label">
            Nhãn (vd. Chi nhánh 1:)
            <input
              className="admin-form-control mt-1"
              value={form.branch1_label}
              onChange={(e) => setForm((f) => ({ ...f, branch1_label: e.target.value }))}
            />
          </label>
          <label className="admin-form-label">
            Hotline
            <input
              className="admin-form-control mt-1"
              value={form.branch1_phone}
              onChange={(e) => setForm((f) => ({ ...f, branch1_phone: e.target.value }))}
            />
          </label>
        </div>
        <label className="admin-form-label">
          Địa chỉ
          <textarea
            rows={2}
            className="admin-form-control mt-1"
            value={form.branch1_address}
            onChange={(e) => setForm((f) => ({ ...f, branch1_address: e.target.value }))}
          />
        </label>
        <label className="admin-form-label">
          URL nhúng Google Maps (iframe src)
          <textarea
            rows={2}
            className="admin-form-control mt-1"
            placeholder="https://www.google.com/maps/embed?pb=..."
            value={form.branch1_map_embed_url}
            onChange={(e) => setForm((f) => ({ ...f, branch1_map_embed_url: e.target.value }))}
          />
        </label>

        <h2 className="admin-section-title text-base mb-2 mt-4">
          Chi nhánh 2
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="admin-form-label">
            Nhãn (vd. Chi nhánh HCM:)
            <input
              className="admin-form-control mt-1"
              value={form.branch2_label}
              onChange={(e) => setForm((f) => ({ ...f, branch2_label: e.target.value }))}
            />
          </label>
          <label className="admin-form-label">
            Hotline
            <input
              className="admin-form-control mt-1"
              value={form.branch2_phone}
              onChange={(e) => setForm((f) => ({ ...f, branch2_phone: e.target.value }))}
            />
          </label>
        </div>
        <label className="admin-form-label">
          Địa chỉ
          <textarea
            rows={2}
            className="admin-form-control mt-1"
            value={form.branch2_address}
            onChange={(e) => setForm((f) => ({ ...f, branch2_address: e.target.value }))}
          />
        </label>
        <label className="admin-form-label">
          URL nhúng Google Maps (iframe src)
          <textarea
            rows={2}
            className="admin-form-control mt-1"
            placeholder="https://www.google.com/maps/embed?pb=..."
            value={form.branch2_map_embed_url}
            onChange={(e) => setForm((f) => ({ ...f, branch2_map_embed_url: e.target.value }))}
          />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="admin-form-label">
            Email
            <input
              type="email"
              className="admin-form-control mt-1"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </label>
          <label className="admin-form-label">
            Website (đầy đủ https://…)
            <input
              type="url"
              className="admin-form-control mt-1"
              value={form.website_url}
              onChange={(e) => setForm((f) => ({ ...f, website_url: e.target.value }))}
            />
          </label>
        </div>
        <label className="admin-form-label">
          Dòng bản quyền (tuỳ chọn)
          <input
            className="admin-form-control mt-1"
            value={form.copyright_line}
            onChange={(e) => setForm((f) => ({ ...f, copyright_line: e.target.value }))}
            placeholder={`© ${new Date().getFullYear()} E-COMMERCE TOOLS`}
          />
        </label>

        <h2 className="admin-section-title text-base mb-2 mt-4">
          Liên kết chính sách
        </h2>
        <p className="text-sm text-[#666666] mb-2">
          Link trong site sẽ tự tạo theo tiêu đề (slug), ví dụ "Chính sách vận chuyển" → <code>/chinh-sach-van-chuyen</code>. Nếu điền
          link ngoài thì sẽ ưu tiên mở link ngoài.
        </p>
        {policies.map((row, i) => (
          <div key={i} className="grid gap-2 border-b border-[#E5E5E5] pb-3 mb-2">
            <label className="admin-form-label">
              Tiêu đề
              <input className="admin-form-control mt-1" value={row.label} onChange={(e) => updatePolicy(i, "label", e.target.value)} placeholder="Hướng dẫn mua hàng" />
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="admin-form-label">
                Đường dẫn (trong site, tự sinh)
                <input className="admin-form-control mt-1" value={slugifyTitle(row.label) ? `/${slugifyTitle(row.label)}` : ""} placeholder="/chinh-sach-van-chuyen" readOnly />
              </label>
              <label className="admin-form-label">
                Hoặc link ngoài
                <input className="admin-form-control mt-1" value={row.href} onChange={(e) => updatePolicy(i, "href", e.target.value)} placeholder="https://..." />
              </label>
            </div>
            {policies.length > 1 ? (
              <CoreButton type="button" tone="danger" className="max-w-32" label="Xóa dòng" onClick={() => removePolicyRow(i)} />
            ) : null}
          </div>
        ))}
          <div>
            <CoreButton type="button" tone="secondary" label="+ Thêm liên kết" onClick={addPolicyRow} />
          </div>

          <div className="mt-4">
            <CoreButton type="submit" label="Lưu chân trang" />
          </div>
        </form>
      </CoreCard>
    </div>
  );
}
