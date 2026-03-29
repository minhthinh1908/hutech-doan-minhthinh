/**
 * Luồng áp dụng voucher (theo activity diagram):
 *
 * 1) Người dùng nhập mã → hệ thống kiểm tra: tồn tại, còn hiệu lực, giới hạn dùng chung,
 *    lịch sử dùng của user (per_user_limit).
 * 2) Kiểm tra điều kiện đơn/giỏ: giá trị tối thiểu (trên phần SP áp dụng), danh mục áp dụng.
 * 3) Tính giảm: % → (tổng áp dụng × %) rồi áp trần max nếu có; cố định → số tiền giảm cố định.
 * 4) Tổng sau giảm = tạm tính − số tiền giảm (không vượt phần áp dụng).
 */

/**
 * @param {object} voucher
 * @param {number} eligibleSubtotal — tổng tiền phần giỏ được phép áp mã (sau lọc danh mục)
 */
function computeDiscountAmount(voucher, eligibleSubtotal) {
    const sub = Number(eligibleSubtotal);
    if (sub <= 0) return 0;
    const type = String(voucher.discount_type || "").toLowerCase();
    let discount = 0;
    if (type === "percent" || type === "percentage") {
        discount = (sub * Number(voucher.discount_value)) / 100;
        if (voucher.max_discount_amount != null) {
            discount = Math.min(discount, Number(voucher.max_discount_amount));
        }
    } else {
        discount = Number(voucher.discount_value);
    }
    discount = Math.max(0, Math.min(discount, sub));
    return Math.round(discount * 100) / 100;
}

/**
 * @param {object|null} voucher
 * @param {Array<{ unit_price: any, quantity: number, product?: { category_id: bigint|string } }>} cartItems
 * @param {{ usedByUserCount?: number }} [options]
 *   - usedByUserCount: số đơn đã dùng mã này (bắt buộc truyền từ controller nếu cần kiểm tra per_user)
 * @returns {{ ok: boolean, message?: string, discount_amount?: number, eligible_subtotal?: number }}
 */
function validateVoucherSync(voucher, cartItems, options = {}) {
    const { usedByUserCount } = options;
    const now = new Date();

    // --- Bước 1: kiểm tra voucher (tồn tại, hiệu lực, lượt dùng, user) ---
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
    if (voucher.per_user_limit != null && usedByUserCount != null && usedByUserCount >= voucher.per_user_limit) {
        return { ok: false, message: "Bạn đã dùng hết lượt áp dụng mã này" };
    }

    const subtotal = cartItems.reduce((s, i) => s + Number(i.unit_price) * i.quantity, 0);

    // --- Bước 2: điều kiện đơn hàng — danh mục + đơn tối thiểu ---
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

    // --- Bước 3: tính số tiền giảm ---
    const discount_amount = computeDiscountAmount(voucher, eligibleSubtotal);
    return { ok: true, discount_amount, eligible_subtotal: eligibleSubtotal };
}

module.exports = {
    computeDiscountAmount,
    validateVoucherSync
};
