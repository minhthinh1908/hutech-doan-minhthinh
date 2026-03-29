const prisma = require("../prisma/client");

function dayStr(d) {
    return new Date(d).toISOString().slice(0, 10);
}

function serialize(rr) {
    return JSON.parse(JSON.stringify(rr, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
}

function stripAdminFields(obj) {
    if (!obj || typeof obj !== "object") return obj;
    const out = { ...obj };
    delete out.admin_notes;
    return out;
}

const includeMine = {
    warranty: {
        include: {
            order_item: {
                include: {
                    product: {
                        select: {
                            product_id: true,
                            product_name: true,
                            sku: true,
                            image_url: true,
                            warranty_months: true
                        }
                    },
                    order: {
                        select: {
                            order_id: true,
                            order_date: true,
                            order_status: true
                        }
                    }
                }
            }
        }
    }
};

function normalizeAttachmentUrls(raw) {
    let urls = raw;
    if (urls == null) return [];
    if (typeof urls === "string") {
        try {
            urls = JSON.parse(urls);
        } catch {
            return [];
        }
    }
    if (!Array.isArray(urls)) return [];
    return urls
        .filter((u) => typeof u === "string" && u.startsWith("/uploads/"))
        .slice(0, 5);
}

async function uploadAttachment(req, res) {
    if (!req.file) {
        return res.status(400).json({ message: "Không có tệp ảnh." });
    }
    return res.json({ url: `/uploads/${req.file.filename}` });
}

async function createForWarranty(req, res) {
    const user_id = BigInt(req.user.user_id);
    const warranty_id = BigInt(req.params.warranty_id);
    const { issue_description } = req.body;
    if (!issue_description || !String(issue_description).trim()) {
        return res.status(400).json({ message: "Vui lòng nhập mô tả sự cố / nhu cầu sửa chữa." });
    }
    const attachment_urls = normalizeAttachmentUrls(req.body.attachment_urls);

    const warranty = await prisma.warranty.findFirst({
        where: { warranty_id, user_id }
    });
    if (!warranty) return res.status(404).json({ message: "Không tìm thấy phiếu bảo hành." });
    if (warranty.status !== "active") {
        return res.status(400).json({ message: "Phiếu bảo hành không còn hiệu lực (đã hết hạn hoặc bị hủy)." });
    }
    const today = dayStr(new Date());
    if (dayStr(warranty.end_date) < today) {
        return res.status(400).json({ message: "Đã quá thời hạn bảo hành, không thể gửi yêu cầu sửa chữa." });
    }

    const rr = await prisma.repairRequest.create({
        data: {
            warranty_id,
            user_id,
            issue_description: String(issue_description).trim(),
            repair_status: "pending",
            ...(attachment_urls.length ? { attachment_urls } : {})
        }
    });
    const full = await prisma.repairRequest.findUnique({
        where: { repair_request_id: rr.repair_request_id },
        include: includeMine
    });
    return res.status(201).json(stripAdminFields(serialize(full)));
}

async function listMine(req, res) {
    const user_id = BigInt(req.user.user_id);
    const items = await prisma.repairRequest.findMany({
        where: { user_id },
        include: includeMine,
        orderBy: { repair_request_id: "desc" }
    });
    return res.json(
        items.map((rr) => stripAdminFields(serialize({ ...rr, repair_request_id: rr.repair_request_id.toString() })))
    );
}

async function getMineById(req, res) {
    const user_id = BigInt(req.user.user_id);
    const repair_request_id = BigInt(req.params.repair_request_id);
    const rr = await prisma.repairRequest.findFirst({
        where: { repair_request_id, user_id },
        include: includeMine
    });
    if (!rr) return res.status(404).json({ message: "Không tìm thấy yêu cầu." });
    return res.json(stripAdminFields(serialize(rr)));
}

module.exports = {
    uploadAttachment,
    createForWarranty,
    listMine,
    getMineById
};
