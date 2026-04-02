import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { apiGet, apiPut, apiUploadFile } from "../../api/client.js";
import { CoreButton, CoreCard, CoreFilterButtons, CoreSpinner } from "../../components/ui/index.js";
import useAdminToastNotices from "../../hooks/useAdminToastNotices.js";
import { slugifyTitle } from "../../utils/slugify.js";

const PAGES = [
  { slug: "gioi-thieu", label: "Giới thiệu" },
  { slug: "dich-vu", label: "Dịch vụ" },
  { slug: "tin-tuc", label: "Tin tức" }
];

function prettyLabelFromSlug(slug) {
  return String(slug || "")
    .split("-")
    .filter(Boolean)
    .map((x) => x.charAt(0).toUpperCase() + x.slice(1))
    .join(" ");
}

function buildDefaultCmsTemplate(title) {
  const t = String(title || "Trang nội dung").trim();
  return `
<h2>${t}</h2>
<p><strong>Cập nhật:</strong> Vui lòng thay nội dung mẫu này bằng thông tin chính thức của doanh nghiệp.</p>
<h3>1) Mục đích và phạm vi</h3>
<p>Nêu rõ mục tiêu của chính sách/trang thông tin, đối tượng áp dụng và phạm vi áp dụng.</p>
<h3>2) Nội dung chính</h3>
<ul>
  <li>Quy định/điều khoản quan trọng thứ nhất.</li>
  <li>Quy định/điều khoản quan trọng thứ hai.</li>
  <li>Các trường hợp ngoại lệ (nếu có).</li>
</ul>
<h3>3) Quy trình thực hiện</h3>
<p>Mô tả các bước để khách hàng thực hiện, thời gian xử lý và kênh hỗ trợ.</p>
<h3>4) Liên hệ hỗ trợ</h3>
<p>Nếu cần hỗ trợ thêm, vui lòng liên hệ hotline hoặc email của cửa hàng.</p>
`;
}

export default function AdminCmsPages() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  useAdminToastNotices({ err, msg, setErr, setMsg });
  const [activeSlug, setActiveSlug] = useState("gioi-thieu");
  const [bySlug, setBySlug] = useState({});
  const [pageOptions, setPageOptions] = useState(PAGES);
  const [newTitle, setNewTitle] = useState("");
  const [newSlugManual, setNewSlugManual] = useState("");
  const [newSlugTouched, setNewSlugTouched] = useState(false);
  const [creating, setCreating] = useState(false);
  const quillRef = useRef(null);

  const load = useCallback(async () => {
    const [rows, footer] = await Promise.all([apiGet("/admin/cms-pages"), apiGet("/site-footer")]);
    const map = {};
    for (const r of rows) {
      map[r.slug] = { title: r.title || "", body_html: r.body_html || "" };
    }

    const policyItems = Array.isArray(footer?.policies_json) ? footer.policies_json : [];
    const policyPages = policyItems
      .filter((p) => p?.label && !p?.href)
      .map((p) => ({ slug: slugifyTitle(p.label), label: p.label.trim() }))
      .filter((p) => p.slug);

    const merged = [...PAGES];
    const seen = new Set(PAGES.map((p) => p.slug));

    for (const p of policyPages) {
      if (seen.has(p.slug)) continue;
      merged.push(p);
      seen.add(p.slug);
    }

    for (const r of rows) {
      if (seen.has(r.slug)) continue;
      merged.push({
        slug: r.slug,
        label: r.title?.trim() || prettyLabelFromSlug(r.slug)
      });
      seen.add(r.slug);
    }

    for (const p of merged) {
      if (!map[p.slug]) map[p.slug] = { title: p.label, body_html: "<p></p>" };
    }

    setPageOptions(merged);
    setBySlug(map);
    if (!map[activeSlug] && merged.length) {
      setActiveSlug(merged[0].slug);
    }
  }, [activeSlug]);

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

  const imageHandler = useCallback(() => {
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/jpeg,image/png,image/webp,image/gif");
    input.click();
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const data = await apiUploadFile("/admin/upload-image", file);
        const url = data?.url ? String(data.url) : "";
        if (!url) return;
        const abs = url.startsWith("http") ? url : `${window.location.origin}${url}`;
        const quill = quillRef.current?.getEditor?.();
        if (!quill) return;
        const range = quill.getSelection(true);
        const idx = range?.index ?? quill.getLength();
        quill.insertEmbed(idx, "image", abs);
        quill.setSelection(idx + 1);
      } catch (e) {
        setErr(e.message || "Không tải được ảnh.");
      }
    };
  }, []);

  const modules = useMemo(
    () => ({
      toolbar: {
        container: [
          [{ header: [1, 2, 3, false] }],
          ["bold", "italic", "underline", "strike"],
          [{ list: "ordered" }, { list: "bullet" }],
          [{ align: [] }],
          ["link", "image"],
          ["clean"]
        ],
        handlers: {
          image: imageHandler
        }
      }
    }),
    [imageHandler]
  );

  const formats = [
    "header",
    "bold",
    "italic",
    "underline",
    "strike",
    "list",
    "bullet",
    "align",
    "link",
    "image"
  ];

  const previewNewSlug = useMemo(
    () => slugifyTitle(newSlugManual || newTitle),
    [newSlugManual, newTitle]
  );
  const newPageSlugDuplicate = Boolean(previewNewSlug && bySlug[previewNewSlug]);

  async function save(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    const cur = bySlug[activeSlug];
    if (!cur) return;
    try {
      await apiPut(
        `/admin/cms-pages/${activeSlug}`,
        { title: cur.title.trim(), body_html: cur.body_html },
        { auth: true }
      );
      setMsg("Đã lưu. Khách xem ngay trên website.");
      await load();
    } catch (e) {
      setErr(e.message || "Không lưu được dữ liệu.");
    }
  }

  async function createManualPage(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    const title = newTitle.trim();
    const slug = slugifyTitle(newSlugManual || newTitle);
    if (!title) {
      setErr("Vui lòng nhập tiêu đề trang mới.");
      return;
    }
    if (!slug) {
      setErr("Slug không hợp lệ. Vui lòng đổi tiêu đề ngắn gọn hơn.");
      return;
    }
    if (bySlug[slug]) {
      setActiveSlug(slug);
      setMsg("Slug đã tồn tại, đã chuyển sang tab trang đó.");
      setNewTitle("");
      setNewSlugManual("");
      setNewSlugTouched(false);
      return;
    }
    try {
      setCreating(true);
      await apiPut(
        `/admin/cms-pages/${slug}`,
        { title, body_html: buildDefaultCmsTemplate(title) },
        { auth: true }
      );
      setNewTitle("");
      setNewSlugManual("");
      setNewSlugTouched(false);
      await load();
      setActiveSlug(slug);
      setMsg("Đã tạo trang CMS mới từ tiêu đề và thêm vào danh sách.");
    } catch (e2) {
      setErr(e2.message || "Không tạo được trang mới");
    } finally {
      setCreating(false);
    }
  }

  function applyTemplateToCurrentPage() {
    const cur = bySlug[activeSlug];
    if (!cur) return;
    const title = String(cur.title || prettyLabelFromSlug(activeSlug)).trim();
    setBySlug((prev) => ({
      ...prev,
      [activeSlug]: {
        ...prev[activeSlug],
        body_html: buildDefaultCmsTemplate(title)
      }
    }));
    setMsg("Đã nạp mẫu nội dung toàn diện cho trang hiện tại. Nhớ bấm Lưu trang này.");
  }

  function setField(field, value) {
    setBySlug((prev) => ({
      ...prev,
      [activeSlug]: { ...prev[activeSlug], [field]: value }
    }));
  }

  if (loading) {
    return (
      <div className="admin-page">
        <div className="flex items-center justify-center gap-3 py-10">
          <CoreSpinner />
          <span className="text-[#666666] font-semibold">Đang tải dữ liệu…</span>
        </div>
      </div>
    );
  }

  const draft = bySlug[activeSlug] || { title: "", body_html: "" };

  const canSubmitNewPage =
    Boolean(newTitle.trim()) && Boolean(previewNewSlug) && !newPageSlugDuplicate && !creating;

  return (
    <div className="admin-page">
      <h1 className="admin-section-title">Trang nội dung CMS</h1>
      <p className="admin-lead">
        Quản lý tất cả trang CMS, gồm trang mặc định và các trang tự sinh từ "Liên kết chính sách" ở chân trang.
      </p>
      <CoreCard>
        <form onSubmit={createManualPage} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <label className="block text-sm font-semibold md:col-span-2">
            Tạo trang CMS thủ công (nhập tiêu đề)
            <input
              type="text"
              className="admin-form-control w-full mt-1"
              value={newTitle}
              onChange={(e) => {
                const nextTitle = e.target.value;
                setNewTitle(nextTitle);
                if (!newSlugTouched) setNewSlugManual(slugifyTitle(nextTitle));
              }}
              placeholder="Ví dụ: Chính sách đổi trả và bảo hành"
            />
          </label>
          <div className="md:col-span-1">
            <label className="block text-sm font-semibold">
              Slug (auto từ title)
              <input
                type="text"
                className={`admin-form-control w-full mt-1 ${newPageSlugDuplicate && previewNewSlug ? "border-red-600 focus:ring-red-500/60" : ""}`}
                value={newSlugManual}
                aria-invalid={newPageSlugDuplicate && Boolean(previewNewSlug)}
                onChange={(e) => {
                  setNewSlugTouched(true);
                  setNewSlugManual(slugifyTitle(e.target.value));
                }}
                placeholder="chinh-sach-doi-tra-va-bao-hanh"
              />
            </label>
            {previewNewSlug && newPageSlugDuplicate ? (
              <p className="mt-1 text-sm text-red-600" role="alert">
                Slug <code className="rounded bg-red-50 px-1">/{previewNewSlug}</code> đã tồn tại. Đổi tiêu đề hoặc slug, hoặc{" "}
                <button
                  type="button"
                  className="font-semibold underline underline-offset-2"
                  onClick={() => {
                    setActiveSlug(previewNewSlug);
                    setMsg("Đã chuyển sang tab trang có slug này.");
                  }}
                >
                  mở trang đó
                </button>
                .
              </p>
            ) : previewNewSlug ? (
              <p className="mt-1 text-xs text-[#666666]">
                URL sẽ là <code className="rounded bg-[#F5F5F5] px-1">/{previewNewSlug}</code>
              </p>
            ) : null}
          </div>
          <div className="md:col-span-3 flex flex-wrap justify-end gap-2">
            <CoreButton
              type="submit"
              label={creating ? "Đang tạo..." : "Tạo trang CMS"}
              disabled={!canSubmitNewPage}
            />
          </div>
        </form>
      </CoreCard>

      <CoreCard>
        <div role="tablist" aria-label="Chọn trang">
          <CoreFilterButtons
            options={pageOptions.map((p) => ({ value: p.slug, label: p.label }))}
            activeValue={activeSlug}
            buttonClassName="!px-3 !py-1.5 text-sm"
            onChange={setActiveSlug}
          />
        </div>
      </CoreCard>

      <CoreCard>
        <form onSubmit={save} className="space-y-4">
          <label className="block text-sm font-semibold">
            Slug URL
            <input type="text" className="admin-form-control w-full mt-1 bg-[#F9F9F9]" value={`/${activeSlug}`} readOnly />
          </label>
          <label className="block text-sm font-semibold">
            Tiêu đề trang (hiển thị dưới banner vàng)
            <input
              type="text"
              className="admin-form-control w-full mt-1"
              value={draft.title}
              onChange={(e) => setField("title", e.target.value)}
              required
              maxLength={200}
            />
          </label>

          <div className="text-sm font-semibold">
            Nội dung
            <div className="mt-2 mb-2">
              <CoreButton type="button" tone="secondary" label="Nạp page mẫu toàn diện" onClick={applyTemplateToCurrentPage} />
            </div>
            <div className="mt-2">
              <ReactQuill
                ref={quillRef}
                theme="snow"
                value={draft.body_html}
                onChange={(html) => setField("body_html", html)}
                modules={modules}
                formats={formats}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <CoreButton type="submit" label="Lưu trang này" />
          </div>
        </form>
      </CoreCard>
    </div>
  );
}
