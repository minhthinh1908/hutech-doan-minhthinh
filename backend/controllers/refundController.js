const prisma = require("../prisma/client");

async function createForOrder(req, res) {
    const user_id = BigInt(req.user.user_id);
    const order_id = BigInt(req.params.order_id);
    const { reason, refund_amount } = req.body;
    if (!reason) return res.status(400).json({ message: "reason is required" });
    if (refund_amount == null) {
        return res.status(400).json({ message: "refund_amount is required" });
    }
    const order = await prisma.order.findFirst({ where: { order_id, user_id } });
    if (!order) return res.status(404).json({ message: "Order not found" });

    const rr = await prisma.refundRequest.create({
        data: {
            order_id,
            user_id,
            reason,
            refund_amount,
            refund_status: "pending"
        }
    });
    return res.status(201).json({
        ...rr,
        refund_request_id: rr.refund_request_id.toString(),
        order_id: rr.order_id.toString(),
        user_id: rr.user_id.toString()
    });
}

async function listMine(req, res) {
    const user_id = BigInt(req.user.user_id);
    const items = await prisma.refundRequest.findMany({
        where: { user_id },
        include: { order: true },
        orderBy: { refund_request_id: "desc" }
    });
    return res.json(
        items.map((r) =>
            JSON.parse(
                JSON.stringify(
                    {
                        ...r,
                        refund_request_id: r.refund_request_id.toString(),
                        order_id: r.order_id.toString(),
                        user_id: r.user_id.toString()
                    },
                    (_, v) => (typeof v === "bigint" ? v.toString() : v)
                )
            )
        )
    );
}

module.exports = { createForOrder, listMine };

