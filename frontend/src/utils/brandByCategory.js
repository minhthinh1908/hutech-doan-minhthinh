import { brandNameToHomeSlug } from "./brandSlug.js";
export { buildSlugToBrandId as buildSlugToBrandIdFromList } from "./brandSlug.js";

/** Thứ tự ưu tiên 5 logo (thiết kế), các hãng khác theo tên sau đó */
export const HOME_BRAND_SLUGS = ["milwaukee", "dewalt", "stanley", "amax", "worx"];

export const NAV_BRAND_META = [
  { slug: "milwaukee", abbr: "M18", name: "Milwaukee" },
  { slug: "dewalt", abbr: "D", name: "DeWalt" },
  { slug: "stanley", abbr: "S", name: "Stanley" },
  { slug: "amax", abbr: "A", name: "Amaxtools" },
  { slug: "worx", abbr: "W", name: "Worx" }
];

/**
 * Thứ tự brand_id hiển thị: 5 hãng chính (nếu có trong DB), sau đó còn lại theo tên vi.
 */
export function buildDisplayOrderBrandIds(brands, slugToBrandId) {
  if (!Array.isArray(brands) || brands.length === 0) return [];
  const idSet = new Set(brands.map((b) => String(b.brand_id)));
  const ordered = [];
  for (const slug of HOME_BRAND_SLUGS) {
    const id = slugToBrandId[slug];
    if (id && idSet.has(String(id))) ordered.push(String(id));
  }
  const rest = [...brands]
    .sort((a, b) => String(a.brand_name).localeCompare(String(b.brand_name), "vi"))
    .map((b) => String(b.brand_id))
    .filter((id) => !ordered.includes(id));
  return [...ordered, ...rest];
}

/**
 * @param {Record<string, string[]>} byRoot — nhóm gốc → [brand_id]
 * @param {string|null} rootId
 * @param {boolean} filterByRoot — true khi đang lọc theo nhóm (mega / sidebar mở)
 * @param {string[]} displayOrderIds — thứ tự hiển thị đầy đủ (từ API)
 */
export function orderedBrandIdsForRoot(byRoot, rootId, filterByRoot, displayOrderIds) {
  const fallback = Array.isArray(displayOrderIds) ? displayOrderIds : [];
  if (!filterByRoot || rootId == null) return fallback;
  const linked = byRoot[String(rootId)];
  if (!linked?.length) return fallback;
  const set = new Set(linked.map(String));
  return fallback.filter((id) => set.has(String(id)));
}

/** Chữ viết tắt cho LED: 5 hãng quen thuộc hoặc 2 ký tự đầu tên */
export function abbrForBrandName(brandName) {
  const legacy = brandNameToHomeSlug(brandName);
  if (legacy) {
    const meta = NAV_BRAND_META.find((m) => m.slug === legacy);
    if (meta) return meta.abbr;
  }
  const compact = String(brandName || "").replace(/\s+/g, "");
  return compact.slice(0, 2).toUpperCase() || "?";
}
