/**
 * Luồng áp dụng voucher (validate + tính giảm) theo use case: tồn tại, hạn, lượt, từng user,
 * giá trị đơn tối thiểu, danh mục áp dụng, % / cố định / trần giảm.
 */

function computeDiscountAmount(voucher, eligibleSubtotal) {
    const sub = Number(eligibleSubtotal);
    if (sub <= 0) return 0;
    const type = String(voucher.discount_type || "").toLowerCase();
    let discount = 0;
    if (type === "percent" || type === "percentage") {
        discount = (sub * Number(voucher.discount_value)) / 100;
    } else {
        discount = Number(voucher.discount_value);
    }
    if (voucher.max_discount_amount != null) {
        discount = Math.min(discount, Number(voucher.max_discount_amount));
    }
    discount = Math.max(0, Math.min(discount, sub));
    return Math.round(discount * 100) / 100;
}

/**
 * @param {object} voucher — bản ghi Prisma Voucher
 * @param {Array<{ unit_price: any, quantity: number, product: { category_id: bigint|string } }>} cartItems
 * @returns {{ ok: boolean, message?: string, discount_amount?: number, eligible_subtotal?: number }}
 */
function validateVoucherSync(voucher, cartItems) {
    const now = new Date();
    if (!voucher) {
        return { ok: false, message: "Mã voucher không tồn tại" };
    }
    if (voucher.status !== "active") {
        return { ok: false, message: "Voucher không còn hiệu lực" };
    }
    if (voucher.start_date > now || voucher.end_date < now) {
        return { ok: false, message: "Voucher hết hạn hoặc chưa đến thời gian áp dụng" };
    }
    if (voucher.usage_limit != null && voucher.usage_count >= voucher.usage_limit) {
        return { ok: false, message: "Voucher đã hết lượt sử dụng" };
    }

    const subtotal = cartItems.reduce(
        (s, i) => s + Number(i.unit_price) * i.quantity,
        0
    );

    const rawCats = voucher.applicable_category_ids;
    let eligibleSubtotal = subtotal;
    if (rawCats != null) {
        const arr = Array.isArray(rawCats) ? rawCats : [];
        if (arr.length > 0) {
            const allowed = new Set(arr.map((c) => String(c)));
            eligibleSubtotal = cartItems.reduce((s, i) => {
                const cid = i.product ? String(i.product.category_id) : "";
                if (allowed.has(cid)) {
                    return s + Number(i.unit_price) * i.quantity;
                }
                return s;
            }, 0);
            if (eligibleSubtotal <= 0) {
                return {
                    ok: false,
                    message: "Giỏ hàng không có sản phẩm thuộc danh mục áp dụng voucher"
                };
            }
        }
    }

    const minOrder = Number(voucher.min_order_value || 0);
    if (eligibleSubtotal < minOrder) {
        return {
            ok: false,
            message: `Đơn hàng cần đạt tối thiểu ${minOrder.toLocaleString("vi-VN")}₫ (phần sản phẩm áp dụng mã)`
        };
    }

    const discount_amount = computeDiscountAmount(voucher, eligibleSubtotal);
    return { ok: true, discount_amount, eligible_subtotal: eligibleSubtotal };
}

module.exports = {
    computeDiscountAmount,
    validateVoucherSync
};
