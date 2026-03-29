const prisma = require("../prisma/client");

function asId(v) {
    return typeof v === "bigint" ? v.toString() : v;
}

async function listUsers(req, res) {
    const users = await prisma.user.findMany({
        include: { role: true },
        orderBy: { user_id: "desc" }
    });
    return res.json(
        users.map((u) => ({
            user_id: asId(u.user_id),
            full_name: u.full_name,
            email: u.email,
            phone: u.phone,
            status: u.status,
            created_at: u.created_at,
            role_id: asId(u.role_id),
            role_name: u.role?.role_name
        }))
    );
}

async function updateUser(req, res) {
    const user_id = BigInt(req.params.user_id);
    const existing = await prisma.user.findUnique({ where: { user_id } });
    if (!existing) return res.status(404).json({ message: "User not found" });

    const data = {};
    if (req.body.full_name !== undefined) data.full_name = req.body.full_name;
    if (req.body.phone !== undefined) data.phone = req.body.phone;
    if (req.body.status !== undefined) data.status = req.body.status;
    if (req.body.role_id !== undefined) data.role_id = BigInt(req.body.role_id);

    const updated = await prisma.user.update({ where: { user_id }, data });
    return res.json({
        user_id: asId(updated.user_id),
        full_name: updated.full_name,
        email: updated.email,
        phone: updated.phone,
        status: updated.status,
        created_at: updated.created_at,
        role_id: asId(updated.role_id)
    });
}

async function listRoles(req, res) {
    const roles = await prisma.role.findMany({ orderBy: { role_id: "asc" } });
    return res.json(roles.map((r) => ({ ...r, role_id: asId(r.role_id) })));
}

async function createRole(req, res) {
    const { role_name } = req.body;
    if (!role_name) return res.status(400).json({ message: "role_name is required" });
    const existing = await prisma.role.findFirst({ where: { role_name } });
    if (existing) return res.status(409).json({ message: "Role already exists" });
    const role = await prisma.role.create({ data: { role_name } });
    return res.status(201).json({ ...role, role_id: asId(role.role_id) });
}

async function deleteRole(req, res) {
    const role_id = BigInt(req.params.role_id);
    const existing = await prisma.role.findUnique({ where: { role_id } });
    if (!existing) return res.status(404).json({ message: "Role not found" });
    await prisma.role.delete({ where: { role_id } });
    return res.json({ message: "Role deleted" });
}

async function listOrders(req, res) {
    const orders = await prisma.order.findMany({
        include: {
            user: { select: { user_id: true, full_name: true, email: true } },
            order_items: { include: { product: true } },
            payments: true,
            order_vouchers: { include: { voucher: true } },
            refund_requests: true
        },
        orderBy: { order_id: "desc" }
    });
    return res.json(
        orders.map((o) => ({
            ...o,
            order_id: asId(o.order_id),
            user_id: asId(o.user_id),
            user: o.user ? { ...o.user, user_id: asId(o.user.user_id) } : null
        }))
    );
}

async function updateOrderStatus(req, res) {
    const order_id = BigInt(req.params.order_id);
    const existing = await prisma.order.findUnique({ where: { order_id } });
    if (!existing) return res.status(404).json({ message: "Order not found" });
    const { order_status, payment_status } = req.body;
    const updated = await prisma.order.update({
        where: { order_id },
        data: {
            ...(order_status !== undefined ? { order_status } : {}),
            ...(payment_status !== undefined ? { payment_status } : {})
        }
    });
    return res.json({
        ...updated,
        order_id: asId(updated.order_id),
        user_id: asId(updated.user_id)
    });
}

async function updatePayment(req, res) {
    const payment_id = BigInt(req.params.payment_id);
    const existing = await prisma.payment.findUnique({ where: { payment_id } });
    if (!existing) return res.status(404).json({ message: "Payment not found" });

    const { payment_status, transaction_code, paid_at } = req.body;
    const updated = await prisma.payment.update({
        where: { payment_id },
        data: {
            ...(payment_status !== undefined ? { payment_status } : {}),
            ...(transaction_code !== undefined ? { transaction_code } : {}),
            ...(paid_at !== undefined ? { paid_at: paid_at ? new Date(paid_at) : null } : {})
        }
    });
    return res.json({
        ...updated,
        payment_id: asId(updated.payment_id),
        order_id: asId(updated.order_id)
    });
}

async function listWarranties(req, res) {
    const warranties = await prisma.warranty.findMany({
        include: {
            user: { select: { user_id: true, full_name: true, email: true } },
            order_item: { include: { product: true, order: true } },
            repair_requests: true
        },
        orderBy: { warranty_id: "desc" }
    });
    return res.json(
        warranties.map((w) => ({
            ...w,
            warranty_id: asId(w.warranty_id),
            order_item_id: asId(w.order_item_id),
            user_id: asId(w.user_id),
            user: w.user ? { ...w.user, user_id: asId(w.user.user_id) } : null
        }))
    );
}

async function updateWarranty(req, res) {
    const warranty_id = BigInt(req.params.warranty_id);
    const existing = await prisma.warranty.findUnique({ where: { warranty_id } });
    if (!existing) return res.status(404).json({ message: "Warranty not found" });
    const { status } = req.body;
    const updated = await prisma.warranty.update({
        where: { warranty_id },
        data: { ...(status !== undefined ? { status } : {}) }
    });
    return res.json({
        ...updated,
        warranty_id: asId(updated.warranty_id),
        order_item_id: asId(updated.order_item_id),
        user_id: asId(updated.user_id)
    });
}

async function listRepairRequests(req, res) {
    const items = await prisma.repairRequest.findMany({
        include: { user: { select: { user_id: true, full_name: true } }, warranty: true },
        orderBy: { repair_request_id: "desc" }
    });
    return res.json(
        items.map((rr) => ({
            ...rr,
            repair_request_id: asId(rr.repair_request_id),
            warranty_id: asId(rr.warranty_id),
            user_id: asId(rr.user_id),
            user: rr.user ? { ...rr.user, user_id: asId(rr.user.user_id) } : null
        }))
    );
}

async function updateRepairRequest(req, res) {
    const repair_request_id = BigInt(req.params.repair_request_id);
    const existing = await prisma.repairRequest.findUnique({ where: { repair_request_id } });
    if (!existing) return res.status(404).json({ message: "Repair request not found" });
    const { repair_status } = req.body;
    const updated = await prisma.repairRequest.update({
        where: { repair_request_id },
        data: { ...(repair_status !== undefined ? { repair_status } : {}) }
    });
    return res.json({
        ...updated,
        repair_request_id: asId(updated.repair_request_id),
        warranty_id: asId(updated.warranty_id),
        user_id: asId(updated.user_id)
    });
}

async function listRefundRequests(req, res) {
    const items = await prisma.refundRequest.findMany({
        include: { user: { select: { user_id: true, full_name: true } }, order: true },
        orderBy: { refund_request_id: "desc" }
    });
    return res.json(
        items.map((r) => ({
            ...r,
            refund_request_id: asId(r.refund_request_id),
            order_id: asId(r.order_id),
            user_id: asId(r.user_id),
            user: r.user ? { ...r.user, user_id: asId(r.user.user_id) } : null
        }))
    );
}

async function updateRefundRequest(req, res) {
    const refund_request_id = BigInt(req.params.refund_request_id);
    const existing = await prisma.refundRequest.findUnique({ where: { refund_request_id } });
    if (!existing) return res.status(404).json({ message: "Refund request not found" });
    const { refund_status } = req.body;
    const updated = await prisma.refundRequest.update({
        where: { refund_request_id },
        data: { ...(refund_status !== undefined ? { refund_status } : {}) }
    });
    return res.json({
        ...updated,
        refund_request_id: asId(updated.refund_request_id),
        order_id: asId(updated.order_id),
        user_id: asId(updated.user_id)
    });
}

async function reportRevenue(req, res) {
    const { from, to, groupBy } = req.query;
    const fromDate = from ? new Date(String(from)) : new Date(Date.now() - 30 * 86400 * 1000);
    const toDate = to ? new Date(String(to)) : new Date();
    const gb = groupBy === "month" ? "month" : "day";

    // Use Prisma raw due to grouping on date parts
    const rows = await prisma.$queryRawUnsafe(
        gb === "month"
            ? `
            SELECT date_trunc('month', order_date) AS bucket,
                   SUM(total_amount)::text AS revenue
            FROM orders
            WHERE order_date >= $1 AND order_date <= $2
              AND payment_status IN ('paid','success')
            GROUP BY bucket
            ORDER BY bucket ASC
          `
            : `
            SELECT date_trunc('day', order_date) AS bucket,
                   SUM(total_amount)::text AS revenue
            FROM orders
            WHERE order_date >= $1 AND order_date <= $2
              AND payment_status IN ('paid','success')
            GROUP BY bucket
            ORDER BY bucket ASC
          `,
        fromDate,
        toDate
    );

    return res.json({ from: fromDate, to: toDate, groupBy: gb, rows });
}

async function dashboard(req, res) {
    const [
        userCount,
        productCount,
        orderCount,
        pendingOrders,
        voucherCount
    ] = await Promise.all([
        prisma.user.count(),
        prisma.product.count(),
        prisma.order.count(),
        prisma.order.count({ where: { order_status: "pending" } }),
        prisma.voucher.count({ where: { status: "active" } })
    ]);
    return res.json({
        users: userCount,
        products: productCount,
        orders: orderCount,
        pending_orders: pendingOrders,
        active_vouchers: voucherCount
    });
}

async function reportTopProducts(req, res) {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const rows = await prisma.$queryRawUnsafe(
        `
        SELECT p.product_id,
               p.product_name,
               SUM(oi.quantity)::int AS total_quantity,
               SUM(oi.line_total)::text AS total_sales
        FROM order_items oi
        JOIN products p ON p.product_id = oi.product_id
        GROUP BY p.product_id, p.product_name
        ORDER BY SUM(oi.quantity) DESC
        LIMIT $1
      `,
        limit
    );
    return res.json({ limit, rows });
}

module.exports = {
    dashboard,
    listUsers,
    updateUser,
    listRoles,
    createRole,
    deleteRole,
    listOrders,
    updateOrderStatus,
    updatePayment,
    listWarranties,
    updateWarranty,
    listRepairRequests,
    updateRepairRequest,
    listRefundRequests,
    updateRefundRequest,
    reportRevenue,
    reportTopProducts
};

