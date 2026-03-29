const prisma = require("../prisma/client");

async function createForWarranty(req, res) {
    const user_id = BigInt(req.user.user_id);
    const warranty_id = BigInt(req.params.warranty_id);
    const { issue_description } = req.body;
    if (!issue_description) {
        return res.status(400).json({ message: "issue_description is required" });
    }
    const warranty = await prisma.warranty.findFirst({
        where: { warranty_id, user_id }
    });
    if (!warranty) return res.status(404).json({ message: "Warranty not found" });

    const rr = await prisma.repairRequest.create({
        data: {
            warranty_id,
            user_id,
            issue_description,
            repair_status: "pending"
        }
    });
    return res.status(201).json({
        ...rr,
        repair_request_id: rr.repair_request_id.toString(),
        warranty_id: rr.warranty_id.toString(),
        user_id: rr.user_id.toString()
    });
}

async function listMine(req, res) {
    const user_id = BigInt(req.user.user_id);
    const items = await prisma.repairRequest.findMany({
        where: { user_id },
        include: { warranty: true },
        orderBy: { repair_request_id: "desc" }
    });
    return res.json(
        items.map((rr) =>
            JSON.parse(
                JSON.stringify(
                    {
                        ...rr,
                        repair_request_id: rr.repair_request_id.toString(),
                        warranty_id: rr.warranty_id.toString(),
                        user_id: rr.user_id.toString()
                    },
                    (_, v) => (typeof v === "bigint" ? v.toString() : v)
                )
            )
        )
    );
}

module.exports = { createForWarranty, listMine };

