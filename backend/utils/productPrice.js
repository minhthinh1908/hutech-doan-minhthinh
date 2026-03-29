/**
 * Giá áp dụng cho giỏ hàng / hiển thị: flash sale trong khung giờ hợp lệ, ngược lại giá thường.
 */
function effectiveUnitPrice(product) {
    if (!product || product.contact_only) return product?.price ?? null;
    if (!product.is_flash_sale || product.flash_sale_price == null) {
        return product.price;
    }
    const now = new Date();
    if (product.flash_sale_start) {
        const t = new Date(product.flash_sale_start);
        if (Number.isFinite(t.getTime()) && now < t) return product.price;
    }
    if (product.flash_sale_end) {
        const t = new Date(product.flash_sale_end);
        if (Number.isFinite(t.getTime()) && now > t) return product.price;
    }
    return product.flash_sale_price;
}

module.exports = { effectiveUnitPrice };
