import { useMemo, useRef, useState } from "react";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Menu } from "primereact/menu";
import { ContextMenu } from "primereact/contextmenu";
import { resolveCopyFields, copyToClipboard } from "../../utils/tableActions.js";
import { exportRowsToExcel } from "../../utils/exportExcel.js";
import { useCoreToast } from "./CoreToast.jsx";

export default function CoreTable({
  value = [],
  columns = [],
  dataKey,
  loading = false,
  emptyMessage = "Không có dữ liệu",
  paginator = true,
  rows = 10,
  className = "",
  tableStyle,
  actionConfig = null,
  /** Ghim cột menu thao tác bên phải khi có `actionConfig` (cần `scrollable` của PrimeReact). */
  pinActionColumn = true,
  enableContextMenu = true,
  onRowContextMenu,
  scrollable: userScrollable,
  scrollHeight: userScrollHeight,
  responsiveLayout: userResponsiveLayout,
  ...rest
}) {
  const toast = useCoreToast();
  const menuRef = useRef(null);
  const contextMenuRef = useRef(null);
  const [menuItems, setMenuItems] = useState([]);
  const [contextMenuSelection, setContextMenuSelection] = useState(null);

  const excelColumns = useMemo(
    () =>
      (actionConfig?.excel?.columns || [])
        .map((col) => {
          if (typeof col === "string") return { header: col, field: col };
          return col;
        })
        .filter(Boolean),
    [actionConfig?.excel?.columns]
  );

  const hasActionMenu = Boolean(actionConfig);
  const safeRows = Array.isArray(value) ? value : [];

  function getRowIdentity(row) {
    if (!row || typeof row !== "object") return "";
    if (typeof actionConfig?.rowIdentity === "function") {
      const custom = actionConfig.rowIdentity(row);
      if (custom) return String(custom);
    }
    const idKey = dataKey || "id";
    if (row[idKey] != null && row[idKey] !== "") return `#${row[idKey]}`;
    if (row.id != null && row.id !== "") return `#${row.id}`;
    const fallback = Object.keys(row).find((k) => /(_id|Id|ID)$/.test(k));
    if (fallback && row[fallback] != null && row[fallback] !== "") return `#${row[fallback]}`;
    return "";
  }

  function getExcelColumns() {
    if (excelColumns.length > 0) return excelColumns;
    return (columns || [])
      .filter((c) => c && typeof c.field === "string" && c.field.trim())
      .map((c) => ({ header: c.header || c.field, field: c.field }));
  }

  async function runAction(command, successMessage = "") {
    try {
      await command();
      if (successMessage) {
        toast.success(successMessage);
      }
    } catch (error) {
      const msg = error?.message || "Thao tác thất bại.";
      if (typeof actionConfig?.onActionError === "function") {
        actionConfig.onActionError(msg, error);
      } else {
        toast.error(msg);
      }
    }
  }

  function buildActionItems(row) {
    const items = [];

    if (typeof actionConfig?.onView === "function") {
      items.push({
        label: actionConfig.labels?.view || "Xem chi tiết",
        icon: "pi pi-eye",
        command: () => runAction(() => actionConfig.onView(row), actionConfig.toastMessages?.viewSuccess || ""),
      });
    }

    if (typeof actionConfig?.onEdit === "function") {
      items.push({
        label: actionConfig.labels?.edit || "Chỉnh sửa",
        icon: "pi pi-pencil",
        command: () => runAction(() => actionConfig.onEdit(row), actionConfig.toastMessages?.editSuccess || ""),
      });
    }

    const copyFields = resolveCopyFields(columns, actionConfig?.copyFields);
    if (copyFields.length > 0) {
      items.push({
        label: actionConfig.labels?.copy || "Copy field",
        icon: "pi pi-copy",
        items: copyFields.map((f) => ({
          label: f.label || f.field || "Field",
          icon: "pi pi-clone",
          command: () =>
            runAction(async () => {
              const val = typeof f.value === "function" ? f.value(row) : row?.[f.field];
              await copyToClipboard(val);
            }, actionConfig.toastMessages?.copySuccess || `Đã copy ${f.label || f.field} ${getRowIdentity(row)}`.trim()),
        })),
      });
    }

    if (actionConfig?.excel !== false) {
      const fileName = actionConfig?.excel?.fileName || "table-export.xlsx";
      const exportCols = getExcelColumns();
      items.push({
        label: actionConfig.labels?.export || "Xuất Excel",
        icon: "pi pi-file-excel",
        items: [
          {
            label: "Xuất dòng hiện tại",
            icon: "pi pi-download",
            command: () =>
              runAction(
                () => exportRowsToExcel([row], exportCols, fileName),
                actionConfig.toastMessages?.exportRowSuccess || `Đã xuất Excel cho dòng ${getRowIdentity(row)}`.trim()
              ),
          },
          {
            label: "Xuất toàn bảng",
            icon: "pi pi-table",
            command: () =>
              runAction(
                () => exportRowsToExcel(safeRows, exportCols, fileName),
                actionConfig.toastMessages?.exportAllSuccess ||
                  `Đã xuất Excel toàn bảng (${safeRows.length} dòng).`
              ),
          },
        ],
      });
    }

    if (typeof actionConfig?.getExtraItems === "function") {
      const extraItems = actionConfig.getExtraItems(row) || [];
      if (extraItems.length > 0) {
        if (items.length > 0) items.push({ separator: true });
        items.push(...extraItems);
      }
    }

    if (typeof actionConfig?.onDelete === "function") {
      if (items.length > 0) items.push({ separator: true });
      items.push({
        label: actionConfig.labels?.delete || "Xóa",
        icon: "pi pi-trash",
        command: () => runAction(() => actionConfig.onDelete(row), actionConfig.toastMessages?.deleteSuccess || ""),
      });
    }

    return items;
  }

  function openPopupMenu(event, row) {
    event.preventDefault();
    const items = buildActionItems(row);
    setMenuItems(items);
    menuRef.current?.toggle(event);
  }

  function openContextMenu(event) {
    if (!hasActionMenu || !enableContextMenu) {
      if (typeof onRowContextMenu === "function") onRowContextMenu(event);
      return;
    }
    const target = event?.originalEvent?.target;
    const interactiveSelector = [
      "select",
      "input",
      "textarea",
      "button",
      "a",
      ".admin-form-control",
      ".p-dropdown",
      ".p-dropdown-panel",
      ".p-multiselect",
      ".p-inputtext",
    ].join(",");
    if (target?.closest?.(interactiveSelector)) {
      if (typeof onRowContextMenu === "function") onRowContextMenu(event);
      return;
    }
    event?.originalEvent?.preventDefault?.();
    const row = event?.data;
    if (!row) return;
    const items = buildActionItems(row);
    setMenuItems(items);
    setContextMenuSelection(row);
    contextMenuRef.current?.show(event.originalEvent);
    if (typeof onRowContextMenu === "function") {
      onRowContextMenu(event);
    }
  }

  const mergedClassName = [
    "p-datatable-sm",
    "core-table",
    hasActionMenu && pinActionColumn ? "core-table--pinned-actions" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const mergedScrollable = Boolean((hasActionMenu && pinActionColumn) || userScrollable);

  const normalizedColumns = hasActionMenu
    ? [
        ...columns,
        {
          key: "__core_actions__",
          header: "",
          frozen: Boolean(pinActionColumn),
          alignFrozen: pinActionColumn ? "right" : undefined,
          className: "core-table-actions-col",
          style: { width: "3.25rem", minWidth: "3.25rem", maxWidth: "4rem", textAlign: "center" },
          body: (row) => (
            <button
              type="button"
              className="core-table-action-trigger"
              onClick={(e) => openPopupMenu(e, row)}
              aria-label="Mở menu thao tác"
            >
              <i className="pi pi-ellipsis-v" />
            </button>
          ),
        },
      ]
    : columns;

  return (
    <>
      {hasActionMenu ? <Menu model={menuItems} popup ref={menuRef} className="core-table-menu" /> : null}
      {hasActionMenu && enableContextMenu ? (
        <ContextMenu model={menuItems} ref={contextMenuRef} className="core-table-menu" />
      ) : null}

      <DataTable
        value={value}
        dataKey={dataKey}
        loading={loading}
        emptyMessage={emptyMessage}
        responsiveLayout={userResponsiveLayout ?? "scroll"}
        scrollable={mergedScrollable}
        scrollHeight={userScrollHeight}
        paginator={paginator}
        rows={rows}
        rowHover
        stripedRows
        showGridlines
        tableStyle={{ minWidth: "1100px", ...tableStyle }}
        className={mergedClassName}
        onContextMenu={openContextMenu}
        contextMenuSelection={contextMenuSelection}
        onContextMenuSelectionChange={(e) => setContextMenuSelection(e.value)}
        {...rest}
      >
        {normalizedColumns.map((col) => {
          const colKey = col.key || col.field || col.header;
          const colProps = { ...col };
          delete colProps.key;
          return <Column key={colKey} {...colProps} />;
        })}
      </DataTable>
    </>
  );
}
