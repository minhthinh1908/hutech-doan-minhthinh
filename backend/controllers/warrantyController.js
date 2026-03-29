const prisma = require("../prisma/client");

/** Đơn phải ở trạng thái “đã giao / hoàn thành” mới kích hoạt BH */
const ORDER_OK_FOR_WARRANTY_ACTIVATION = new Set(["completed", "shipped"]);

function serializeWarranty(w) {
    return JSON.parse(
        JSON.stringify(
            {
                ...w,
                warranty_id: w.warranty_id.toString(),
                order_item_id: w.order_item_id.toString(),
                user_id: w.user_id.toString()
            },
            (_, v) => (typeof v === "bigint" ? v.toString() : v)
        )
    );
}

async function listMyWarranties(req, res) {
    const user_id = BigInt(req.user.user_id);
    const warranties = await prisma.warranty.findMany({
        where: { user_id },
        include: {
            order_item: { include: { product: true, order: true } },
            repair_requests: true
        },
        orderBy: { warranty_id: "desc" }
    });
    return res.json(warranties.map((w) => serializeWarranty(w)));
}

/**
 * POST /api/warranties/activate/:order_item_id
 * Kích hoạt bảo hành sau khi nhận hàng (đơn completed | shipped).
 */
async function activateByOrderItem(req, res) {
    const user_id = BigInt(req.user.user_id);
    const order_item_id = BigInt(req.params.order_item_id);

    const w = await prisma.warranty.findFirst({
        where: { order_item_id, user_id },
        include: {
            order_item: {
                include: {
                    order: { select: { order_id: true, order_status: true } },
                    product: { select: { warranty_months: true } }
                }
            }
        }
    });

    if (!w) {
        return res.status(404).json({ message: "Không tìm thấy phiếu bảo hành cho dòng đơn này." });
    }
    if (w.status !== "pending") {
        return res.status(400).json({ message: "Phiếu bảo hành đã được kích hoạt hoặc không còn ở trạng thái chờ." });
    }

    const orderStatus = w.order_item?.order?.order_status;
    if (!orderStatus || !ORDER_OK_FOR_WARRANTY_ACTIVATION.has(String(orderStatus))) {
        return res.status(400).json({
            message:
                "Chỉ kích hoạt bảo hành khi đơn hàng đã giao / hoàn thành. Vui lòng đợi cửa hàng cập nhật trạng thái đơn."
        });
    }

    const months =
        Number(w.warranty_months_snapshot) > 0
            ? Number(w.warranty_months_snapshot)
            : Number(w.order_item?.product?.warranty_months || 0);
    if (!months || months <= 0) {
        return res.status(400).json({ message: "Sản phẩm không có thời hạn bảo hành hợp lệ." });
    }

    const start = new Date();
    const end = new Date(start);
    end.setMonth(end.getMonth() + months);

    const updated = await prisma.warranty.update({
        where: { warranty_id: w.warranty_id },
        data: {
            status: "active",
            activated_at: new Date(),
            start_date: start,
            end_date: end
        },
        include: {
            order_item: { include: { product: true, order: true } },
            repair_requests: true
        }
    });

    return res.json(serializeWarranty(updated));
}

module.exports = { listMyWarranties, activateByOrderItem };
