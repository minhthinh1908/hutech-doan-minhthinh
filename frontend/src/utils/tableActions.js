export async function copyToClipboard(value) {
  const text = value == null ? "" : String(value);
  if (!text) throw new Error("Không có dữ liệu để copy.");
  if (!navigator?.clipboard?.writeText) {
    throw new Error("Trình duyệt không hỗ trợ clipboard API.");
  }
  await navigator.clipboard.writeText(text);
  return text;
}

export function resolveCopyFields(columns = [], copyFields = null) {
  if (Array.isArray(copyFields) && copyFields.length > 0) {
    return copyFields;
  }

  return (columns || [])
    .filter((c) => c && typeof c.field === "string" && c.field.trim())
    .map((c) => ({
      label: c.header || c.field,
      field: c.field,
    }));
}
