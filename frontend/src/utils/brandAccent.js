/**
 * Khóa giao diện theo tên thương hiệu (màu nổi bật giống POSM từng hãng).
 * Khớp không phân biệt hoa thường / bỏ dấu nhẹ.
 */
export function getBrandAccentKey(brandName) {
  const raw = String(brandName || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (raw.includes("milwaukee")) return "milwaukee";
  if (raw.includes("dewalt")) return "dewalt";
  if (raw.includes("stanley")) return "stanley";
  if (raw.includes("worx")) return "worx";
  if (raw.includes("amax")) return "amax";
  if (raw.includes("makita")) return "makita";
  if (raw.includes("bosch")) return "bosch";
  if (raw.includes("hikoki") || raw.includes("hitachi")) return "hikoki";
  return "default";
}
