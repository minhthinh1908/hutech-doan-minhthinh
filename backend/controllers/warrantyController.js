const prisma = require("../prisma/client");

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
    return res.json(
        warranties.map((w) =>
            JSON.parse(
                JSON.stringify(
                    {
                        ...w,
                        warranty_id: w.warranty_id.toString(),
                        order_item_id: w.order_item_id.toString(),
                        user_id: w.user_id.toString()
                    },
                    (_, v) => (typeof v === "bigint" ? v.toString() : v)
                )
            )
        )
    );
}

module.exports = { listMyWarranties };

