import { useCallback, useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../../api/client.js";
import { CoreButton, CoreCard, CoreCheckbox, CoreTable } from "../../components/ui/index.js";
import useAdminToastNotices from "../../hooks/useAdminToastNotices.js";

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
  useAdminToastNotices({ err, msg, setErr, setMsg });

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
      setErr(e.message || "Không tạo được dữ liệu.");
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
      setErr(e.message || "Không xóa được dữ liệu.");
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
      setErr(e.message || "Không lưu được dữ liệu.");
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
      setErr(e.message || "Không lưu được dữ liệu.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-page">
      <h1 className="admin-section-title">Thương hiệu</h1>
      <p className="admin-lead">
        <strong>Danh sách dưới</strong>: thêm / xóa hãng (xóa chỉ khi không còn sản phẩm).{" "}
        <strong>Ma trận</strong>: chọn hãng nào hiện khi khách chọn từng nhóm danh mục gốc — đồng bộ với thanh «THƯƠNG HIỆU»
        và lọc trang chủ. Khi mở trang Sản phẩm, dropdown «Thương hiệu» lấy đúng danh sách này.
      </p>
      <CoreCard>
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <CoreButton
            type="button"
            disabled={seeding}
            label={seeding ? "Đang tạo…" : "Đồng bộ 5 thương hiệu mẫu (Milwaukee, DEWALT, …)"}
            onClick={() => seedFiveBrands()}
          />
          <span className="text-sm text-[#666666]">
          Nếu DB trống, <strong>GET /brands</strong> cũng tự tạo mẫu một lần. Sau đó có thể tick ma trận và{" "}
          <strong>Danh mục → Đồng bộ</strong> nếu cần thêm nhóm.
        </span>
        </div>
      </CoreCard>
      <CoreCard>
        <h2 className="admin-section-title">Thương hiệu theo nhóm danh mục</h2>
        {tree.length === 0 ? (
          <p className="text-sm text-[#666666]">Chưa có danh mục gốc. Vào Admin → Danh mục → Đồng bộ catalog mẫu.</p>
        ) : matrixBrands.length === 0 ? (
          <p className="text-sm text-[#666666]">Chưa có thương hiệu nào — thêm ở form bên dưới hoặc bấm nút phía trên.</p>
        ) : (
          <>
            <div className="overflow-auto">
              <table className="admin-matrix-table min-w-max text-sm">
                <thead>
                  <tr>
                    <th className="p-2 text-left">Nhóm danh mục (gốc)</th>
                    {matrixBrands.map((b) => (
                      <th key={b.brand_id} className="text-center p-2 whitespace-nowrap">
                        {b.brand_name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tree.map((root) => (
                    <tr key={root.category_id} className="hover:bg-[#FFF8E1] transition-colors">
                      <td className="p-2 font-semibold whitespace-nowrap">{root.category_name}</td>
                      {matrixBrands.map((b) => {
                        const rk = String(root.category_id);
                        const checked = (draft[rk] || []).includes(String(b.brand_id));
                        return (
                          <td key={b.brand_id} className="p-2 text-center">
                            <CoreCheckbox checked={checked} onChange={() => toggle(root.category_id, b.brand_id)} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <CoreButton
              type="button"
              className="mt-3"
              disabled={saving}
              label={saving ? "Đang lưu…" : "Lưu ma trận thương hiệu"}
              onClick={() => saveMatrix()}
            />
          </>
        )}
      </CoreCard>

      <CoreCard>
        <h2 className="admin-section-title">Thêm thương hiệu</h2>
        <form className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end" onSubmit={submit}>
          <label className="admin-form-label">
            Tên thương hiệu
            <input required value={name} onChange={(e) => setName(e.target.value)} className="admin-form-control mt-1" />
          </label>
          <label className="admin-form-label">
            Mô tả (tuỳ chọn)
            <input value={desc} onChange={(e) => setDesc(e.target.value)} className="admin-form-control mt-1" />
          </label>
          <div>
            <CoreButton type="submit" label="Thêm thương hiệu" />
          </div>
        </form>
      </CoreCard>

      <CoreCard>
        <h2 className="admin-section-title">Danh sách (xóa chỉ khi không còn sản phẩm)</h2>
        <CoreTable
          value={items}
          dataKey="brand_id"
          emptyMessage="Chưa có thương hiệu nào. Bấm «Đồng bộ 5 thương hiệu mẫu» để tạo dữ liệu."
          columns={[
            { key: "id", header: "ID", field: "brand_id" },
            { key: "name", header: "Tên", field: "brand_name" },
          ]}
          actionConfig={{
            onDelete: (row) => removeBrand(row.brand_id),
            copyFields: [
              { label: "ID thương hiệu", field: "brand_id" },
              { label: "Tên thương hiệu", field: "brand_name" },
            ],
            excel: { fileName: "admin-brands.xlsx" },
          }}
        />
      </CoreCard>
    </div>
  );
}
