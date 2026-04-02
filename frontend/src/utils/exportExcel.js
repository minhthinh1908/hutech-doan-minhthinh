import { saveAs } from "file-saver";
import * as XLSX from "xlsx";

function mapRows(rows = [], columns = []) {
  return rows.map((row) => {
    const item = {};
    columns.forEach((col) => {
      const key = col.header || col.field || "Column";
      const val = typeof col.value === "function" ? col.value(row) : row?.[col.field];
      item[key] = val ?? "";
    });
    return item;
  });
}

export function exportRowsToExcel(rows = [], columns = [], fileName = "table-export.xlsx") {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("Không có dữ liệu để xuất Excel.");
  }
  if (!Array.isArray(columns) || columns.length === 0) {
    throw new Error("Chưa cấu hình cột xuất Excel.");
  }

  const data = mapRows(rows, columns);
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");

  const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
  });
  saveAs(blob, fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`);
}
