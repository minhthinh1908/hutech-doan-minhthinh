import { useCallback, useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost } from "../../api/client.js";
import { DragDropProvider, useDroppable } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { move } from "@dnd-kit/helpers";
import { MEGA_COLS, splitIntoColumns } from "../../utils/categoryMega.js";
import { CoreButton, CoreCard, CoreMessage, CoreSpinner, CoreTable } from "../../components/ui/index.js";
import useAdminToastNotices from "../../hooks/useAdminToastNotices.js";

function RootSortableItem({ id, index, label }) {
  const { ref, sourceRef, isDragging } = useSortable({
    id,
    index,
    group: "roots",
  });

  return (
    <li ref={ref}>
      <button
        ref={sourceRef}
        type="button"
        className={[
          "w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 text-left text-sm font-semibold text-[#111111]",
          "transition-all duration-200 hover:border-[#FFC107] hover:bg-[#FFF8E1]",
          isDragging ? "opacity-70 shadow-md" : "",
        ].join(" ")}
      >
        {label}
      </button>
    </li>
  );
}

function ChildSortableItem({ id, index, group, label }) {
  const { ref, sourceRef, isDragging } = useSortable({
    id,
    index,
    group,
  });

  return (
    <li ref={ref}>
      <button
        ref={sourceRef}
        type="button"
        className={[
          "w-full rounded-md border border-[#E5E5E5] bg-white px-2.5 py-1.5 text-left text-sm text-[#111111]",
          "transition-all duration-200 hover:border-[#FFC107] hover:bg-[#FFF8E1]",
          isDragging ? "opacity-70 shadow-sm" : "",
        ].join(" ")}
      >
        {label}
      </button>
    </li>
  );
}

function ChildColumn({ id, title, childrenCount, children }) {
  const { ref, isDropTarget } = useDroppable({ id });
  return (
    <section
      ref={ref}
      className={[
        "rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] p-3",
        isDropTarget ? "ring-2 ring-[#FFC107]/60" : "",
      ].join(" ")}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="m-0 text-sm font-extrabold text-[#111111]">{title}</h3>
        <span className="text-xs text-[#666666]">{childrenCount} mục con</span>
      </div>
      {children}
    </section>
  );
}

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
  const [rootsDnD, setRootsDnD] = useState([]);
  const [childrenDnD, setChildrenDnD] = useState({});
  const [savingOrder, setSavingOrder] = useState(false);
  useAdminToastNotices({ err, msg, setErr, setMsg });

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

  useEffect(() => {
    const rootIds = (tree || []).map((r) => String(r.category_id));
    const childrenMap = {};
    for (const root of tree || []) {
      childrenMap[String(root.category_id)] = (root.children || []).map((ch) => String(ch.category_id));
    }
    setRootsDnD(rootIds);
    setChildrenDnD(childrenMap);
  }, [tree]);

  async function seedDefaults() {
    setErr("");
    setMsg("");
    setSyncing(true);
    try {
      const data = await apiPost("/categories/seed-defaults", {}, { auth: true });
      setMsg(data?.message || "Đã đồng bộ catalog mẫu.");
      await load();
    } catch (e) {
      setErr(e.message || "Không đồng bộ được dữ liệu.");
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
      setErr(e.message || "Không lưu được dữ liệu.");
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
      setErr(e.message || "Không xóa được dữ liệu.");
    }
  }

  async function saveTreeOrder() {
    setErr("");
    setMsg("");
    setSavingOrder(true);
    try {
      const payload = {
        roots: rootsDnD.map((rootId) => ({
          id: rootId,
          children: childrenDnD[rootId] || [],
        })),
      };
      await apiPatch("/categories/reorder", payload, { auth: true });
      setMsg("Đã lưu thứ tự danh mục (gốc + mục con) từ kéo thả.");
      await load();
    } catch (e) {
      setErr(e.message || "Không lưu được dữ liệu.");
    } finally {
      setSavingOrder(false);
    }
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

  return (
    <div className="admin-page">
      <h1 className="admin-section-title">Danh mục</h1>
      <p className="admin-lead">
        <strong>Sáu nhóm gốc</strong> (không chọn cha) = cột trái menu «Danh mục sản phẩm» / sidebar trang chủ.{" "}
        <strong>Danh mục con</strong> (chọn cha) = các ô nhỏ bên phải, 5 cột. Sản phẩm gán vào{" "}
        <em>danh mục con</em> trong trang Sản phẩm admin.
      </p>

      {items.length === 0 ? (
        <CoreCard>
          <strong>Chưa có danh mục trong database.</strong> Nhấn «Đồng bộ catalog mẫu» để tạo 6 nhóm (
          MÁY MÓC CẦM TAY … DỤNG CỤ ĐO LƯỜNG) và đầy đủ danh mục con giống menu khách — không xóa dữ liệu cũ
          nếu đã có tên trùng.
        </CoreCard>
      ) : null}

      <CoreCard>
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <CoreButton
            type="button"
            disabled={syncing}
            label={syncing ? "Đang đồng bộ…" : "Đồng bộ catalog mẫu (6 nhóm + danh mục con)"}
            onClick={() => seedDefaults()}
          />
          <span className="text-sm text-[#666666]">
            Dùng khi DB trống hoặc thiếu nhóm; chỉ <strong>thêm</strong> mục chưa có.
          </span>
        </div>
      </CoreCard>

      <CoreCard>
        <h2 className="admin-section-title">JTree kéo thả sắp xếp danh mục</h2>
        <p className="admin-lead mt-1">
          Kéo thả để đổi thứ tự danh mục gốc và mục con. Mục con có thể kéo sang nhóm gốc khác. Bấm Lưu để cập nhật
          <code> sort_order </code> và <code> parent_id </code>.
        </p>

        <div className="grid grid-cols-1 xl:grid-cols-[320px,1fr] gap-4 mt-3">
          <section className="rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] p-3">
            <h3 className="m-0 mb-2 text-sm font-extrabold text-[#111111]">Danh mục gốc</h3>
            <DragDropProvider
              onDragOver={(event) => {
                setRootsDnD((items) => move(items, event));
              }}
            >
              <ul className="m-0 list-none space-y-2 p-0">
                {rootsDnD.map((rootId, index) => {
                  const root = tree.find((r) => String(r.category_id) === rootId);
                  return (
                    <RootSortableItem
                      key={rootId}
                      id={rootId}
                      index={index}
                      label={root?.category_name || `#${rootId}`}
                    />
                  );
                })}
              </ul>
            </DragDropProvider>
          </section>

          <DragDropProvider
            onDragOver={(event) => {
              setChildrenDnD((items) => move(items, event));
            }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {rootsDnD.map((rootId) => {
                const root = tree.find((r) => String(r.category_id) === rootId);
                const childIds = childrenDnD[rootId] || [];
                return (
                  <ChildColumn
                    key={rootId}
                    id={rootId}
                    title={root?.category_name || `#${rootId}`}
                    childrenCount={childIds.length}
                  >
                    <ul className="m-0 list-none space-y-1.5 p-0 min-h-[2.5rem]">
                      {childIds.map((childId, index) => {
                        const child = items.find((c) => String(c.category_id) === childId);
                        return (
                          <ChildSortableItem
                            key={childId}
                            id={childId}
                            index={index}
                            group={rootId}
                            label={child?.category_name || `#${childId}`}
                          />
                        );
                      })}
                    </ul>
                  </ChildColumn>
                );
              })}
            </div>
          </DragDropProvider>
        </div>

        <div className="mt-4">
          <CoreButton
            type="button"
            label={savingOrder ? "Đang lưu thứ tự…" : "Lưu thứ tự kéo thả"}
            disabled={savingOrder}
            onClick={saveTreeOrder}
          />
        </div>
      </CoreCard>

      <CoreCard>
        <h2 className="admin-section-title">Xem trước menu khách (mega menu)</h2>
        <p className="admin-lead mt-1">
          Giống bố cục storefront: mỗi nhóm gốc → danh mục con chia 5 cột (lần lượt từ trên xuống).
        </p>
        {tree.length === 0 ? (
          <p className="text-sm text-[#666666]">Chưa có cây danh mục. Đồng bộ hoặc thêm danh mục gốc + con.</p>
        ) : (
          tree.map((root) => {
            const children = root.children || [];
            const cols = splitIntoColumns(children, MEGA_COLS);
            return (
              <div key={root.category_id} className="mt-3 rounded-xl border border-[#E5E5E5] p-3">
                <div className="font-extrabold">{root.category_name}</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mt-2">
                  {cols.map((col, ci) => (
                    <ul key={ci} className="space-y-1 text-sm text-[#666666]">
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
      </CoreCard>

      <CoreCard>
        <h2 className="admin-section-title">{editingId ? `Sửa danh mục #${editingId}` : "Thêm danh mục thủ công"}</h2>
        <form className="max-w-3xl space-y-3" onSubmit={submit}>
          <label className="admin-form-label">
            Tên danh mục *
            <input required value={name} onChange={(e) => setName(e.target.value)} className="admin-form-control mt-1" />
          </label>
          <label className="admin-form-label">
            Mô tả (tuỳ chọn)
            <input value={desc} onChange={(e) => setDesc(e.target.value)} className="admin-form-control mt-1" />
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="admin-form-label">
              Thuộc danh mục cha (để trống = danh mục gốc)
              <select className="admin-form-control mt-1" value={parentId} onChange={(e) => setParentId(e.target.value)}>
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
            <label className="admin-form-label">
              Thứ tự (số nhỏ lên trước)
              <input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="admin-form-control mt-1" />
            </label>
          </div>
          <div className="flex gap-2">
            <CoreButton type="submit" label={editingId ? "Cập nhật" : "Thêm danh mục"} />
            {editingId ? <CoreButton type="button" tone="secondary" label="Hủy" onClick={cancelEdit} /> : null}
          </div>
        </form>
      </CoreCard>

      <CoreCard>
        <h2 className="admin-section-title">Bảng tất cả danh mục</h2>
        <CoreTable
          value={items}
          dataKey="category_id"
          emptyMessage="Chưa có danh mục nào."
          columns={[
            { key: "id", header: "ID", field: "category_id" },
            { key: "name", header: "Tên", field: "category_name" },
            { key: "parent", header: "Cha", body: (c) => parentLabel(c.parent_id) },
            { key: "sort", header: "Sort", body: (c) => c.sort_order ?? 0 },
          ]}
          actionConfig={{
            onEdit: (row) => startEdit(row),
            onDelete: (row) => remove(row.category_id),
            copyFields: [
              { label: "ID danh mục", field: "category_id" },
              { label: "Tên danh mục", field: "category_name" },
              { label: "Danh mục cha", value: (row) => parentLabel(row.parent_id) },
            ],
            excel: { fileName: "admin-categories.xlsx" },
          }}
        />
      </CoreCard>
    </div>
  );
}
