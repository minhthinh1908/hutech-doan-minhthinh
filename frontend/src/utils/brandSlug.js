/**
 * Slug cố định cho 5 hãng quen thuộc (URL đẹp, bookmark cũ).
 * Hãng khác dùng dạng b{id} để luôn khớp DB / admin.
 */
export function brandNameToHomeSlug(brandName) {
  const s = String(brandName || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (s.includes("milwaukee")) return "milwaukee";
  if (s.includes("dewalt")) return "dewalt";
  if (s.includes("stanley")) return "stanley";
  if (s.includes("amax")) return "amax";
  if (s.includes("worx")) return "worx";
  return null;
}

/** Slug đưa vào query ?brand= — mọi hãng trong DB đều có khóa duy nhất */
export function brandToUrlSlug(brand) {
  const legacy = brandNameToHomeSlug(brand.brand_name);
  if (legacy) return legacy;
  return `b${brand.brand_id}`;
}

/** { milwaukee: "1", b7: "7", ... } — đủ để trang chủ + menu đồng bộ admin */
export function buildSlugToBrandId(brands) {
  const map = {};
  if (!Array.isArray(brands)) return map;
  for (const b of brands) {
    const slug = brandToUrlSlug(b);
    map[slug] = String(b.brand_id);
  }
  return map;
}

/**
 * Query ?brand= → brand_id (chuỗi). Hỗ trợ: slug cũ, b{id}, hoặc id thuần.
 */
export function resolveBrandParam(param, slugToBrandId, brands) {
  if (param == null || param === "") return null;
  const p = String(param).trim();
  if (slugToBrandId[p]) return String(slugToBrandId[p]);
  if (/^\d+$/.test(p) && brands?.some((b) => String(b.brand_id) === p)) return p;
  return null;
}
