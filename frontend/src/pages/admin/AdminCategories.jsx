import { useCallback, useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost } from "../../api/client.js";
import { MEGA_COLS, splitIntoColumns } from "../../utils/categoryMega.js";
import "./AdminPages.css";

export default function AdminCategories() {
  const [items, setItems] = useState([]);
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [parentId, setParentId] = useState("");
  const [sortOrder, setSortOrder] = useState("0");

  const load = useCallback(async () => {
    const [flat, treeData] = await Promise.all([apiGet("/categories"), apiGet("/categories/tree")]);
    setItems(Array.isArray(flat) ? flat : []);
    setTree(Array.isArray(treeData) ? treeData : []);
  }, []);

  const roots = useMemo(
    () => items.filter((c) => !c.parent_id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [items]
  );

  function parentLabel(id) {
    if (!id) return "—";
    const p = items.find((c) => String(c.category_id) === String(id));
    return p?.category_name ?? id;
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr("");
      try {
        await load();
      } catch (e) {
        if (!cancelled) setErr(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function seedDefaults() {
    setErr("");
    setMsg("");
    setSyncing(true);
    try {
      const data = await apiPost("/categories/seed-defaults", {}, { auth: true });
      setMsg(data?.message || "Đã đồng bộ catalog mẫu.");
      await load();
    } catch (e) {
      setErr(e.message || "Không đồng bộ được");
    } finally {
      setSyncing(false);
    }
  }

  function startEdit(c) {
    setEditingId(c.category_id);
    setName(c.category_name || "");
    setDesc(c.description || "");
    setParentId(c.parent_id ? String(c.parent_id) : "");
    setSortOrder(String(c.sort_order ?? 0));
    setMsg("");
  }

  function cancelEdit() {
    setEditingId(null);
    setName("");
    setDesc("");
    setParentId("");
    setSortOrder("0");
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    const payload = {
      category_name: name.trim(),
      description: desc.trim() || null,
      parent_id: parentId || null,
      sort_order: parseInt(sortOrder, 10) || 0
    };
    try {
      if (editingId) {
        await apiPatch(`/categories/${editingId}`, payload, { auth: true });
        setMsg("Đã cập nhật danh mục.");
        cancelEdit();
      } else {
        await apiPost("/categories", payload, { auth: true });
        setMsg("Đã thêm danh mục.");
        setName("");
        setDesc("");
        setParentId("");
        setSortOrder("0");
      }
      await load();
    } catch (e) {
      setErr(e.message || "Lỗi");
    }
  }

  async function remove(id) {
    if (!window.confirm("Xóa danh mục này?")) return;
    setErr("");
    try {
      await apiDelete(`/categories/${id}`, { auth: true });
      setMsg("Đã xóa.");
      if (String(editingId) === String(id)) cancelEdit();
      await load();
    } catch (e) {
      setErr(e.message || "Không xóa được");
    }
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
      <h1>Danh mục</h1>
      <p className="admin-page__muted">
        <strong>Sáu nhóm gốc</strong> (không chọn cha) = cột trái menu «Danh mục sản phẩm» / sidebar trang chủ.{" "}
        <strong>Danh mục con</strong> (chọn cha) = các ô nhỏ bên phải, 5 cột. Sản phẩm gán vào{" "}
        <em>danh mục con</em> trong trang Sản phẩm admin.
      </p>

      {items.length === 0 ? (
        <div className="admin-empty-categories" role="status">
          <strong>Chưa có danh mục trong database.</strong> Nhấn «Đồng bộ catalog mẫu» để tạo 6 nhóm (
          MÁY MÓC CẦM TAY … DỤNG CỤ ĐO LƯỜNG) và đầy đủ danh mục con giống menu khách — không xóa dữ liệu cũ
          nếu đã có tên trùng.
        </div>
      ) : null}

      <div className="admin-category-toolbar">
        <button
          type="button"
          className="admin-btn admin-btn--gold"
          disabled={syncing}
          onClick={() => seedDefaults()}
        >
          {syncing ? "Đang đồng bộ…" : "Đồng bộ catalog mẫu (6 nhóm + danh mục con)"}
        </button>
        <span className="admin-page__muted" style={{ margin: 0 }}>
          Dùng khi DB trống hoặc thiếu nhóm; chỉ <strong>thêm</strong> mục chưa có.
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

      <section className="admin-category-preview" aria-labelledby="preview-heading">
        <h2 id="preview-heading">Xem trước menu khách (mega menu)</h2>
        <p className="admin-category-preview__hint">
          Giống bố cục storefront: mỗi nhóm gốc → danh mục con chia 5 cột (lần lượt từ trên xuống).
        </p>
        {tree.length === 0 ? (
          <p className="admin-page__muted">Chưa có cây danh mục. Đồng bộ hoặc thêm danh mục gốc + con.</p>
        ) : (
          tree.map((root) => {
            const children = root.children || [];
            const cols = splitIntoColumns(children, MEGA_COLS);
            return (
              <div key={root.category_id} className="admin-tree-preview__block">
                <div className="admin-tree-preview__parent">{root.category_name}</div>
                <div className="admin-tree-preview__cols">
                  {cols.map((col, ci) => (
                    <ul key={ci} className="admin-tree-preview__col">
                      {col.map((ch) => (
                        <li key={ch.category_id}>{ch.category_name}</li>
                      ))}
                    </ul>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </section>

      <form className="admin-form admin-form--wide" style={{ maxWidth: "640px" }} onSubmit={submit}>
        <h2 className="admin-page__muted" style={{ margin: 0, fontSize: "1rem" }}>
          {editingId ? `Sửa danh mục #${editingId}` : "Thêm danh mục thủ công"}
        </h2>
        <label>
          Tên danh mục *
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Mô tả (tuỳ chọn)
          <input value={desc} onChange={(e) => setDesc(e.target.value)} />
        </label>
        <div className="admin-form__row">
          <label>
            Thuộc danh mục cha (để trống = danh mục gốc)
            <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">— Gốc —</option>
              {roots
                .filter((r) => String(r.category_id) !== String(editingId))
                .map((r) => (
                  <option key={r.category_id} value={String(r.category_id)}>
                    {r.category_name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Thứ tự (số nhỏ lên trước)
            <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
          </label>
        </div>
        <div>
          <button type="submit" className="admin-btn">
            {editingId ? "Cập nhật" : "Thêm danh mục"}
          </button>
          {editingId ? (
            <button type="button" className="admin-btn" style={{ marginLeft: "0.5rem", background: "#666" }} onClick={cancelEdit}>
              Hủy
            </button>
          ) : null}
        </div>
      </form>

      <h2 className="admin-page__muted" style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>
        Bảng tất cả danh mục
      </h2>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Tên</th>
              <th>Cha</th>
              <th>Sort</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ color: "#666" }}>
                  Không có dòng nào.
                </td>
              </tr>
            ) : (
              items.map((c) => (
                <tr key={c.category_id}>
                  <td>{c.category_id}</td>
                  <td>{c.category_name}</td>
                  <td>{parentLabel(c.parent_id)}</td>
                  <td>{c.sort_order ?? 0}</td>
                  <td>
                    <button type="button" className="admin-btn" style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }} onClick={() => startEdit(c)}>
                      Sửa
                    </button>{" "}
                    <button
                      type="button"
                      className="admin-btn admin-btn--danger"
                      style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                      onClick={() => remove(c.category_id)}
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
