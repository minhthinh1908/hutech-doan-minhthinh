import { useCallback, useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../../api/client.js";
import "./AdminPages.css";

export default function AdminBrands() {
  const [items, setItems] = useState([]);
  const [tree, setTree] = useState([]);
  const [draft, setDraft] = useState({});
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const loadAll = useCallback(async () => {
    const [brands, cb, treeData] = await Promise.all([
      apiGet("/brands"),
      apiGet("/category-brands"),
      apiGet("/categories/tree")
    ]);
    setItems(Array.isArray(brands) ? brands : []);
    const roots = Array.isArray(treeData) ? treeData : [];
    setTree(roots);
    const by = (cb && cb.by_root) || {};
    const d = {};
    for (const r of roots) {
      const k = String(r.category_id);
      d[k] = by[k] ? [...by[k].map(String)] : [];
    }
    setDraft(d);
  }, []);

  useEffect(() => {
    loadAll().catch((e) => setErr(e.message));
  }, [loadAll]);

  /** Cột ma trận = mọi thương hiệu trong DB (sắp tên) */
  const matrixBrands = useMemo(() => {
    return [...items].sort((a, b) => String(a.brand_name).localeCompare(String(b.brand_name), "vi"));
  }, [items]);

  async function seedFiveBrands() {
    setErr("");
    setMsg("");
    setSeeding(true);
    try {
      const data = await apiPost("/brands/seed-defaults", {}, { auth: true });
      setMsg(data?.message || "Đã đồng bộ thương hiệu mẫu.");
      await loadAll();
    } catch (e) {
      setErr(e.message || "Không tạo được");
    } finally {
      setSeeding(false);
    }
  }

  async function removeBrand(id) {
    if (!window.confirm("Xóa thương hiệu này? (Chỉ được nếu không còn sản phẩm nào gán hãng đó.)")) return;
    setErr("");
    setMsg("");
    try {
      await apiDelete(`/brands/${id}`, { auth: true });
      setMsg("Đã xóa thương hiệu. Trang khách và form sản phẩm sẽ dùng danh sách mới sau khi tải lại.");
      await loadAll();
    } catch (e) {
      setErr(e.message || "Không xóa được");
    }
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    try {
      await apiPost("/brands", { brand_name: name.trim(), description: desc.trim() || null }, { auth: true });
      setMsg("Đã thêm thương hiệu — có thể tick trong ma trận và lưu để hiện trên menu theo nhóm.");
      setName("");
      setDesc("");
      await loadAll();
    } catch (e) {
      setErr(e.message || "Lỗi");
    }
  }

  function toggle(rootId, brandId) {
    const rk = String(rootId);
    const bid = String(brandId);
    setDraft((prev) => {
      const next = { ...prev };
      const arr = [...(next[rk] || [])];
      const i = arr.indexOf(bid);
      if (i >= 0) arr.splice(i, 1);
      else arr.push(bid);
      next[rk] = arr;
      return next;
    });
  }

  async function saveMatrix() {
    setErr("");
    setMsg("");
    setSaving(true);
    try {
      await apiPut("/category-brands", { by_root: draft }, { auth: true });
      setMsg("Đã lưu: thương hiệu hiển thị theo từng nhóm danh mục (menu + trang chủ).");
      await loadAll();
    } catch (e) {
      setErr(e.message || "Không lưu được");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-page">
      <h1>Thương hiệu</h1>
      <p className="admin-page__muted">
        <strong>Danh sách dưới</strong>: thêm / xóa hãng (xóa chỉ khi không còn sản phẩm).{" "}
        <strong>Ma trận</strong>: chọn hãng nào hiện khi khách chọn từng nhóm danh mục gốc — đồng bộ với thanh «THƯƠNG HIỆU»
        và lọc trang chủ. Khi mở trang Sản phẩm, dropdown «Thương hiệu» lấy đúng danh sách này.
      </p>
      <div className="admin-category-toolbar" style={{ marginBottom: "0.75rem" }}>
        <button type="button" className="admin-btn admin-btn--gold" disabled={seeding} onClick={() => seedFiveBrands()}>
          {seeding ? "Đang tạo…" : "Đồng bộ 5 thương hiệu mẫu (Milwaukee, DEWALT, …)"}
        </button>
        <span className="admin-page__muted" style={{ margin: 0 }}>
          Nếu DB trống, <strong>GET /brands</strong> cũng tự tạo mẫu một lần. Sau đó có thể tick ma trận và{" "}
          <strong>Danh mục → Đồng bộ</strong> nếu cần thêm nhóm.
        </span>
      </div>
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

      <section className="admin-brand-matrix" style={{ marginBottom: "1.5rem" }}>
        <h2 className="admin-page__muted" style={{ fontSize: "1rem", margin: "0 0 0.75rem" }}>
          Thương hiệu theo nhóm danh mục
        </h2>
        {tree.length === 0 ? (
          <p className="admin-page__muted">Chưa có danh mục gốc. Vào Admin → Danh mục → Đồng bộ catalog mẫu.</p>
        ) : matrixBrands.length === 0 ? (
          <p className="admin-page__muted">Chưa có thương hiệu nào — thêm ở form bên dưới hoặc bấm nút vàng phía trên.</p>
        ) : (
          <>
            <div className="admin-table-wrap">
              <table className="admin-table admin-table--matrix">
                <thead>
                  <tr>
                    <th>Nhóm danh mục (gốc)</th>
                    {matrixBrands.map((b) => (
                      <th key={b.brand_id} className="admin-table__th-brand">
                        {b.brand_name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tree.map((root) => (
                    <tr key={root.category_id}>
                      <td>
                        <strong>{root.category_name}</strong>
                      </td>
                      {matrixBrands.map((b) => {
                        const rk = String(root.category_id);
                        const checked = (draft[rk] || []).includes(String(b.brand_id));
                        return (
                          <td key={b.brand_id} style={{ textAlign: "center" }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggle(root.category_id, b.brand_id)}
                              aria-label={`${root.category_name} — ${b.brand_name}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className="admin-btn" disabled={saving} onClick={() => saveMatrix()}>
              {saving ? "Đang lưu…" : "Lưu ma trận thương hiệu"}
            </button>
          </>
        )}
      </section>

      <h2 className="admin-page__muted" style={{ fontSize: "1rem", margin: "0 0 0.5rem" }}>
        Thêm thương hiệu
      </h2>
      <form className="admin-form" onSubmit={submit}>
        <label>
          Tên thương hiệu
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Mô tả (tuỳ chọn)
          <input value={desc} onChange={(e) => setDesc(e.target.value)} />
        </label>
        <button type="submit" className="admin-btn">
          Thêm thương hiệu
        </button>
      </form>

      <h2 className="admin-page__muted" style={{ fontSize: "1rem", margin: "1.25rem 0 0.5rem" }}>
        Danh sách (sửa/xóa — xóa chỉ khi không còn sản phẩm)
      </h2>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Tên</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ color: "#666" }}>
                  Đang trống — tải lại trang hoặc bấm «Đồng bộ 5 thương hiệu mẫu».
                </td>
              </tr>
            ) : (
              items.map((b) => (
                <tr key={b.brand_id}>
                  <td>{b.brand_id}</td>
                  <td>{b.brand_name}</td>
                  <td>
                    <button
                      type="button"
                      className="admin-btn admin-btn--danger"
                      style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                      onClick={() => removeBrand(b.brand_id)}
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
