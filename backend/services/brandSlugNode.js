/** Khớp frontend `utils/brandSlug.js` — slug trên URL trang chủ */
function brandNameToHomeSlug(brandName) {
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

module.exports = { brandNameToHomeSlug };
