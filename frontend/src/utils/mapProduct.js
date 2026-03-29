/**
 * Flash sale đang hiệu lực (theo cờ + khung giờ + có giá flash).
 */
export function isFlashSaleActive(p) {
  if (!p?.is_flash_sale || p.flash_sale_price == null) return false;
  const fsp = Number(p.flash_sale_price);
  if (!Number.isFinite(fsp)) return false;
  const now = Date.now();
  if (p.flash_sale_start) {
    const t = new Date(p.flash_sale_start).getTime();
    if (Number.isFinite(t) && now < t) return false;
  }
  if (p.flash_sale_end) {
    const t = new Date(p.flash_sale_end).getTime();
    if (Number.isFinite(t) && now > t) return false;
  }
  return true;
}

/**
 * Chuẩn hóa sản phẩm từ API → props cho ProductCard
 */
export function mapApiProductToCard(p) {
  const basePrice = p.price != null ? Number(p.price) : 0;
  const contactOnly = Boolean(p.contact_only);
  const flashActive = isFlashSaleActive(p);
  const flashNum = p.flash_sale_price != null ? Number(p.flash_sale_price) : null;
  const price =
    !contactOnly && flashActive && flashNum != null && Number.isFinite(flashNum) ? flashNum : basePrice;

  const oldRaw = p.old_price != null ? Number(p.old_price) : null;
  let oldPrice = null;
  let discount = null;

  if (!contactOnly && flashActive && flashNum != null && basePrice > flashNum && basePrice > 0) {
    oldPrice = basePrice;
    discount = Math.round(((basePrice - flashNum) / basePrice) * 100);
  } else if (
    !contactOnly &&
    oldRaw != null &&
    Number.isFinite(oldRaw) &&
    oldRaw > price &&
    oldRaw > 0
  ) {
    oldPrice = oldRaw;
    discount = Math.round(((oldRaw - price) / oldRaw) * 100);
  }

  return {
    id: String(p.product_id),
    product_id: String(p.product_id),
    name: p.product_name,
    price,
    oldPrice,
    discount,
    hot: Boolean(p.is_hot),
    flashSale: flashActive,
    contactOnly,
    image: p.image_url || null,
    brand: p.brand?.brand_name || "",
    description: p.description,
    sku: p.sku,
    stock_quantity: p.stock_quantity,
    warranty_months: p.warranty_months,
    category: p.category?.category_name,
    raw: p
  };
}
