const prisma = require("../prisma/client");
const {
    assertAdminCannotMarkGatewayPaidWithoutFlow,
    assertOrderCanBeMarkedPaid,
    PAYMENT_LINE_SUCCESS,
    syncCodBankTransferPaymentsForAdminPaidOrder
} = require("../services/paymentBusinessRules");
const { ALLOWED_PAYMENT_STATUSES, isAllowedPaymentStatus } = require("../constants/paymentStatus");
const { appendPaymentStatusLog } = require("../services/paymentStatusLog");

function asId(v) {
    return typeof v === "bigint" ? v.toString() : v;
}

function parseIntSafe(v, fallback) {
    const n = Number.parseInt(String(v ?? ""), 10);
    return Number.isFinite(n) ? n : fallback;
}

function parsePagination(req, { defaultLimit = 20, maxLimit = 100 } = {}) {
    // Supports either:
    // - page/limit (1-indexed)
    // - first/rows (PrimeReact DataTable style)
    const hasPage = req.query.page != null || req.query.limit != null;
    const hasFirst = req.query.first != null || req.query.rows != null;
    if (!hasPage && !hasFirst) return null;

    let limit = parseIntSafe(hasFirst ? req.query.rows : req.query.limit, defaultLimit);
    if (limit < 1) limit = defaultLimit;
    if (limit > maxLimit) limit = maxLimit;

    let page = parseIntSafe(req.query.page, 1);
    if (hasFirst) {
        const first = Math.max(0, parseIntSafe(req.query.first, 0));
        page = Math.floor(first / limit) + 1;
    }
    if (page < 1) page = 1;

    const skip = (page - 1) * limit;
    return { page, limit, skip, take: limit };
}

function parseSort(req, allowedFields, fallback) {
    const sortField = req.query.sortField != null ? String(req.query.sortField).trim() : "";
    const sortOrderRaw = req.query.sortOrder != null ? String(req.query.sortOrder).trim() : "";
    const sortOrderNum = Number(sortOrderRaw);
    const direction = sortOrderNum === -1 || sortOrderRaw.toLowerCase() === "desc" ? "desc" : "asc";

    if (sortField && allowedFields.includes(sortField)) {
        return { [sortField]: direction };
    }
    return fallback;
}

/** JSON an toàn khi Prisma trả BigInt / Decimal lồng nhau */
function serializeBigInt(obj) {
    return JSON.parse(
        JSON.stringify(obj, (_, v) => {
            if (typeof v === "bigint") return v.toString();
            if (v != null && typeof v === "object" && typeof v.toFixed === "function") return v.toString();
            return v;
        })
    );
}

const ALLOWED_ORDER_STATUSES = [
    "pending",
    "confirmed",
    "shipping",
    "completed",
    "cancelled",
    "processing",
    "shipped"
];

/** Trạng thái dòng `payments.payment_status` (gateway / COD / CK) */
const ALLOWED_PAYMENT_ROW_STATUSES = [
    "pending",
    "processing",
    "success",
    "failed",
    "paid",
    "cancelled",
    "timeout",
    "callback_failed"
];

const ALLOWED_REFUND_STATUSES = ["pending", "approved", "rejected", "completed"];

const REPAIR_STATUSES = [
    "pending",
    "received",
    "checking",
    "repairing",
    "in_progress",
    "waiting_parts",
    "repaired",
    "rejected",
    "completed",
    "cancelled"
];

/** Đồng bộ với AdminWarrantyItem.status (admin có thể đặt thủ công) */
const ALLOWED_WARRANTY_STATUSES = ["active", "expired", "claimed", "void", "pending"];

const WARRANTY_LIST_INCLUDE = {
    user: { select: { user_id: true, full_name: true, email: true, phone: true } },
    order_item: {
        include: {
            product: true,
            order: { select: { order_id: true, order_date: true, order_status: true } }
        }
    },
    repair_requests: { orderBy: { request_date: "desc" } }
};

function toIso(d) {
    if (d == null) return undefined;
    const x = d instanceof Date ? d : new Date(d);
    return Number.isNaN(x.getTime()) ? undefined : x.toISOString();
}

/** So sánh theo ngày lịch UTC */
function utcDayMs(d) {
    const x = d instanceof Date ? d : new Date(d);
    return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
}

function daysRemainingCalendar(endDate) {
    const end = utcDayMs(endDate);
    const today = utcDayMs(new Date());
    return Math.round((end - today) / 86400000);
}

/** Trùng khớp `AdminWarrantyItem` (frontend). `delivered_at` chỉ thêm khi Order có cột ngày giao. */
function serializeAdminWarrantyItem(w) {
    if (!w) return null;
    const order = w.order_item?.order;
    const orderId = order ? asId(order.order_id) : undefined;
    const product = w.order_item?.product;
    const user = w.user;
    const repairs = Array.isArray(w.repair_requests) ? w.repair_requests : [];
    const latest = repairs[0];
    const dr = w.end_date != null ? daysRemainingCalendar(w.end_date) : null;
    const expiredByEndDate = dr != null && dr < 0;
    const isExpired = w.status === "expired" || w.status === "void" || expiredByEndDate;
    const warrantyId = asId(w.warranty_id);

    return {
        warranty_id: warrantyId,
        order_item_id: asId(w.order_item_id),
        order_id: orderId,
        order_code: orderId != null ? `DH-${String(orderId).padStart(6, "0")}` : undefined,
        order_status: order?.order_status ?? undefined,

        user_id: asId(w.user_id),
        user_name: user?.full_name ?? "",
        user_email: user?.email,
        user_phone: user?.phone ?? undefined,

        product_id: product ? asId(product.product_id) : "",
        product_name: product?.product_name ?? "",
        product_sku: product?.sku,
        product_image: product?.image_url ?? undefined,

        warranty_code: `BH-${warrantyId}`,
        warranty_months: product?.warranty_months ?? undefined,

        start_date: toIso(w.start_date) ?? "",
        end_date: toIso(w.end_date) ?? "",
        status: w.status,

        repair_request_count: repairs.length,
        latest_repair_status: latest?.repair_status,

        admin_note: w.admin_note ?? undefined,
        is_expired: isExpired,
        days_remaining: dr,

        activated_at: toIso(w.activated_at) ?? toIso(w.start_date),
        warranty_months_snapshot: w.warranty_months_snapshot ?? 0,
        created_at: toIso(w.created_at),
        updated_at: toIso(w.updated_at)
    };
}

const repairInclude = {
    user: { select: { user_id: true, full_name: true, email: true, phone: true } },
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
                            order_status: true,
                            total_amount: true
                        }
                    }
                }
            }
        }
    }
};

async function listUsers(req, res) {
    const pg = parsePagination(req, { defaultLimit: 20, maxLimit: 100 });
    const orderBy = parseSort(req, ["user_id", "created_at", "full_name", "email", "status", "role_id"], {
        user_id: "desc"
    });

    if (pg) {
        const [total, users] = await Promise.all([
            prisma.user.count(),
            prisma.user.findMany({
                select: {
                    user_id: true,
                    full_name: true,
                    email: true,
                    phone: true,
                    address: true,
                    status: true,
                    created_at: true,
                    role_id: true,
                    role: true
                },
                orderBy,
                skip: pg.skip,
                take: pg.take
            })
        ]);
        return res.json({
            items: users.map((u) => ({
                user_id: asId(u.user_id),
                full_name: u.full_name,
                email: u.email,
                phone: u.phone,
                address: u.address,
                status: u.status,
                created_at: u.created_at,
                role_id: asId(u.role_id),
                role_name: u.role?.role_name
            })),
            total
        });
    }
    const users = await prisma.user.findMany({
        select: {
            user_id: true,
            full_name: true,
            email: true,
            phone: true,
            address: true,
            status: true,
            created_at: true,
            role_id: true,
            role: true
        },
        orderBy: { user_id: "desc" }
    });
    return res.json(
        users.map((u) => ({
            user_id: asId(u.user_id),
            full_name: u.full_name,
            email: u.email,
            phone: u.phone,
            address: u.address,
            status: u.status,
            created_at: u.created_at,
            role_id: asId(u.role_id),
            role_name: u.role?.role_name
        }))
    );
}

async function getUser(req, res) {
    const user_id = BigInt(req.params.user_id);
    const u = await prisma.user.findUnique({
        where: { user_id },
        select: {
            user_id: true,
            full_name: true,
            email: true,
            phone: true,
            address: true,
            status: true,
            created_at: true,
            role_id: true,
            role: { select: { role_id: true, role_name: true } },
            _count: { select: { orders: true } }
        }
    });
    if (!u) return res.status(404).json({ message: "User not found" });
    return res.json({
        user_id: asId(u.user_id),
        full_name: u.full_name,
        email: u.email,
        phone: u.phone,
        address: u.address,
        status: u.status,
        created_at: u.created_at,
        role_id: asId(u.role_id),
        role_name: u.role?.role_name,
        order_count: u._count.orders
    });
}

/** Gộp đơn hàng, đánh giá, bảo hành, sửa chữa, hoàn tiền — sắp xếp theo thời gian (mới nhất trước). */
async function getUserActivity(req, res) {
    const user_id = BigInt(req.params.user_id);
    const exists = await prisma.user.findUnique({ where: { user_id }, select: { user_id: true } });
    if (!exists) return res.status(404).json({ message: "User not found" });

    const [orders, reviews, warranties, repairs, refunds] = await Promise.all([
        prisma.order.findMany({
            where: { user_id },
            select: {
                order_id: true,
                order_date: true,
                order_status: true,
                payment_status: true,
                total_amount: true
            },
            orderBy: { order_date: "desc" },
            take: 80
        }),
        prisma.review.findMany({
            where: { user_id },
            select: {
                review_id: true,
                created_at: true,
                rating: true,
                product: { select: { product_id: true, product_name: true } }
            },
            orderBy: { created_at: "desc" },
            take: 40
        }),
        prisma.warranty.findMany({
            where: { user_id },
            select: {
                warranty_id: true,
                start_date: true,
                end_date: true,
                status: true,
                order_item: {
                    select: { product: { select: { product_name: true } } }
                }
            },
            orderBy: { start_date: "desc" },
            take: 40
        }),
        prisma.repairRequest.findMany({
            where: { user_id },
            select: {
                repair_request_id: true,
                request_date: true,
                repair_status: true,
                issue_description: true
            },
            orderBy: { request_date: "desc" },
            take: 40
        }),
        prisma.refundRequest.findMany({
            where: { user_id },
            select: {
                refund_request_id: true,
                request_date: true,
                refund_status: true,
                refund_amount: true,
                order_id: true
            },
            orderBy: { request_date: "desc" },
            take: 40
        })
    ]);

    const events = [];

    for (const o of orders) {
        events.push({
            kind: "order",
            at: o.order_date.toISOString(),
            title: `Đơn hàng #${asId(o.order_id)}`,
            meta: `${o.order_status || ""} · ${o.payment_status || ""}`,
            detail: {
                order_id: asId(o.order_id),
                order_status: o.order_status,
                payment_status: o.payment_status,
                total_amount: o.total_amount != null ? String(o.total_amount) : null
            }
        });
    }

    for (const r of reviews) {
        events.push({
            kind: "review",
            at: r.created_at.toISOString(),
            title: `Đánh giá sản phẩm`,
            meta: r.product?.product_name ? `${r.product.product_name} · ${r.rating}★` : `${r.rating}★`,
            detail: {
                review_id: asId(r.review_id),
                product_id: r.product ? asId(r.product.product_id) : null,
                product_name: r.product?.product_name ?? null,
                rating: r.rating
            }
        });
    }

    for (const w of warranties) {
        const pn = w.order_item?.product?.product_name;
        events.push({
            kind: "warranty",
            at: w.start_date ? new Date(w.start_date).toISOString() : new Date(0).toISOString(),
            title: "Bảo hành",
            meta: `${w.status || ""}${pn ? ` · ${pn}` : ""}`,
            detail: {
                warranty_id: asId(w.warranty_id),
                status: w.status,
                end_date: w.end_date ? new Date(w.end_date).toISOString().slice(0, 10) : null
            }
        });
    }

    for (const rp of repairs) {
        events.push({
            kind: "repair",
            at: rp.request_date.toISOString(),
            title: "Yêu cầu sửa chữa",
            meta: rp.repair_status || "",
            detail: {
                repair_request_id: asId(rp.repair_request_id),
                repair_status: rp.repair_status
            }
        });
    }

    for (const f of refunds) {
        events.push({
            kind: "refund",
            at: f.request_date.toISOString(),
            title: `Yêu cầu hoàn tiền · Đơn #${asId(f.order_id)}`,
            meta: `${f.refund_status || ""}${f.refund_amount != null ? ` · ${String(f.refund_amount)}đ` : ""}`,
            detail: {
                refund_request_id: asId(f.refund_request_id),
                order_id: asId(f.order_id),
                refund_status: f.refund_status,
                refund_amount: f.refund_amount != null ? String(f.refund_amount) : null
            }
        });
    }

    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    return res.json(events.slice(0, 100));
}

async function updateUser(req, res) {
    const user_id = BigInt(req.params.user_id);
    const existing = await prisma.user.findUnique({ where: { user_id } });
    if (!existing) return res.status(404).json({ message: "User not found" });

    const data = {};
    if (req.body.full_name !== undefined) data.full_name = req.body.full_name;
    if (req.body.phone !== undefined) data.phone = req.body.phone;
    if (req.body.address !== undefined) {
        data.address =
            req.body.address === null || req.body.address === "" ? null : String(req.body.address).trim();
    }
    if (req.body.status !== undefined) data.status = req.body.status;
    if (req.body.role_id !== undefined) data.role_id = BigInt(req.body.role_id);

    const updated = await prisma.user.update({ where: { user_id }, data });
    return res.json({
        user_id: asId(updated.user_id),
        full_name: updated.full_name,
        email: updated.email,
        phone: updated.phone,
        address: updated.address,
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
    const rawStatus = req.query.order_status;
    const rawQ = req.query.q != null ? String(req.query.q).trim() : "";
    const rawUserId = req.query.user_id != null ? String(req.query.user_id).trim() : "";
    const where = {};

    if (rawUserId) {
        if (!/^\d+$/.test(rawUserId)) {
            return res.status(400).json({ message: "user_id phải là số nguyên dương" });
        }
        try {
            where.user_id = BigInt(rawUserId);
        } catch {
            return res.status(400).json({ message: "user_id không hợp lệ" });
        }
    }

    if (rawStatus && String(rawStatus) !== "all") {
        const st = String(rawStatus);
        if (!ALLOWED_ORDER_STATUSES.includes(st)) {
            return res.status(400).json({
                message: "order_status không hợp lệ (dùng all hoặc một trong: pending, confirmed, shipping, completed, cancelled, processing, shipped)"
            });
        }
        where.order_status = st;
    }

    const qClean = rawQ.replace(/^#/, "");
    if (qClean) {
        if (!/^\d+$/.test(qClean)) {
            return res.status(400).json({ message: "q (mã đơn) chỉ gồm chữ số, ví dụ 12 hoặc #12" });
        }
        try {
            where.order_id = BigInt(qClean);
        } catch {
            return res.status(400).json({ message: "Mã đơn không hợp lệ" });
        }
    }

    const pg = parsePagination(req, { defaultLimit: 20, maxLimit: 100 });
    const orderBy = parseSort(req, ["order_id", "order_date", "total_amount", "order_status", "payment_status"], {
        order_id: "desc"
    });

    if (pg) {
        const [total, orders] = await Promise.all([
            prisma.order.count({ where }),
            prisma.order.findMany({
                where,
                include: {
                    user: { select: { user_id: true, full_name: true, email: true, phone: true } },
                    order_items: { include: { product: true } },
                    payments: true,
                    order_vouchers: { include: { voucher: true } },
                    refund_requests: true
                },
                orderBy,
                skip: pg.skip,
                take: pg.take
            })
        ]);
        return res.json({ items: serializeBigInt(orders), total });
    }

    const orders = await prisma.order.findMany({
        where,
        include: {
            user: { select: { user_id: true, full_name: true, email: true, phone: true } },
            order_items: { include: { product: true } },
            payments: true,
            order_vouchers: { include: { voucher: true } },
            refund_requests: true
        },
        orderBy: { order_id: "desc" }
    });
    return res.json(serializeBigInt(orders));
}

async function getOrder(req, res) {
    const order_id = BigInt(req.params.order_id);
    const order = await prisma.order.findUnique({
        where: { order_id },
        include: {
            user: { select: { user_id: true, full_name: true, email: true, phone: true } },
            order_items: { include: { product: true } },
            payments: true,
            order_vouchers: { include: { voucher: true } },
            refund_requests: true,
            payment_status_logs: { orderBy: { created_at: "desc" }, take: 200 }
        }
    });
    if (!order) return res.status(404).json({ message: "Order not found" });
    return res.json(serializeBigInt(order));
}

async function updateOrderStatus(req, res) {
    const order_id = BigInt(req.params.order_id);
    const existing = await prisma.order.findUnique({ where: { order_id } });
    if (!existing) return res.status(404).json({ message: "Order not found" });
    const { order_status, payment_status } = req.body;
    if (order_status !== undefined && !ALLOWED_ORDER_STATUSES.includes(String(order_status))) {
        return res.status(400).json({
            message:
                "order_status không hợp lệ (pending | confirmed | shipping | completed | cancelled hoặc legacy)"
        });
    }
    if (payment_status !== undefined) {
        const ps = String(payment_status).toLowerCase();
        if (!isAllowedPaymentStatus(ps)) {
            return res.status(400).json({
                message: `payment_status phải là một trong: ${ALLOWED_PAYMENT_STATUSES.join(", ")}`
            });
        }
    }
    let updated;
    try {
        updated = await prisma.$transaction(async (tx) => {
            if (payment_status !== undefined && String(payment_status).toLowerCase() === "paid") {
                const sync = await syncCodBankTransferPaymentsForAdminPaidOrder(tx, order_id);
                if (!sync.ok) {
                    throw new Error(`BAD_REQUEST:${sync.message}`);
                }
                const okPaid = await assertOrderCanBeMarkedPaid(tx, order_id);
                if (!okPaid.ok) {
                    throw new Error(`BAD_REQUEST:${okPaid.message}`);
                }
            }
            const before = await tx.order.findUnique({ where: { order_id } });
            const u = await tx.order.update({
                where: { order_id },
                data: {
                    ...(order_status !== undefined ? { order_status } : {}),
                    ...(payment_status !== undefined ? { payment_status } : {})
                }
            });
            if (payment_status !== undefined && before.payment_status !== u.payment_status) {
                await appendPaymentStatusLog({
                    tx,
                    order_id,
                    payment_id: null,
                    from_status: before.payment_status,
                    to_status: u.payment_status,
                    source: "admin",
                    note: `Cập nhật trạng thái thanh toán đơn (admin #${req.user?.user_id ?? "?"})`
                });
            }
            return u;
        });
    } catch (e) {
        const msg = String(e?.message || "");
        if (msg.startsWith("BAD_REQUEST:")) {
            return res.status(400).json({ message: msg.slice("BAD_REQUEST:".length) });
        }
        throw e;
    }
    return res.json(serializeBigInt(updated));
}

async function listPayments(req, res) {
    const searchRaw = req.query.search != null ? String(req.query.search).trim() : "";
    const rawQ = req.query.q != null ? String(req.query.q).trim() : "";
    const rawSearch = searchRaw || rawQ;

    const statusRaw = req.query.status != null ? String(req.query.status).trim() : "";
    const paymentStatusRaw =
        req.query.payment_status != null ? String(req.query.payment_status).trim() : "";
    const rawStatus = statusRaw || paymentStatusRaw;

    const paymentMethod =
        req.query.payment_method != null ? String(req.query.payment_method).trim() : "";

    const from_date = req.query.from_date;
    const to_date = req.query.to_date;

    const quick = req.query.quick != null ? String(req.query.quick).trim() : "";

    const and = [];

    if (quick === "failed") {
        and.push({
            OR: [{ payment_status: "failed" }, { order: { payment_status: "failed" } }]
        });
    } else if (quick === "abnormal") {
        and.push({
            OR: [
                { is_abnormal: true },
                { payment_status: { in: ["timeout", "callback_failed"] } },
                { error_code: { not: null } }
            ]
        });
    } else if (quick === "refunded") {
        and.push({ order: { payment_status: "refunded" } });
    } else if (rawStatus && rawStatus !== "all") {
        const allowed = [...ALLOWED_PAYMENT_ROW_STATUSES];
        if (!allowed.includes(rawStatus)) {
            return res.status(400).json({
                message: `status / payment_status phải là all hoặc một trong: ${allowed.join(", ")}`
            });
        }
        and.push({ payment_status: rawStatus });
    }
    if (paymentMethod && paymentMethod !== "all") {
        and.push({ payment_method: paymentMethod });
    }
    if (from_date || to_date) {
        const rd = {};
        if (from_date) rd.gte = new Date(String(from_date));
        if (to_date) {
            const end = new Date(String(to_date));
            end.setUTCHours(23, 59, 59, 999);
            rd.lte = end;
        }
        and.push({ order: { order_date: rd } });
    }
    if (rawSearch) {
        if (/^\d+$/.test(rawSearch)) {
            try {
                const n = BigInt(rawSearch);
                and.push({ OR: [{ order_id: n }, { payment_id: n }] });
            } catch {
                return res.status(400).json({ message: "Mã đơn / mã thanh toán không hợp lệ" });
            }
        } else {
            and.push({
                OR: [
                    { transaction_code: { contains: rawSearch, mode: "insensitive" } },
                    {
                        order: {
                            user: {
                                email: { contains: rawSearch, mode: "insensitive" }
                            }
                        }
                    },
                    {
                        order: {
                            user: {
                                full_name: { contains: rawSearch, mode: "insensitive" }
                            }
                        }
                    }
                ]
            });
        }
    }

    const where = and.length > 0 ? { AND: and } : {};

    const pg = parsePagination(req, { defaultLimit: 20, maxLimit: 100 });
    const orderBy = parseSort(req, ["payment_id", "paid_at", "payment_status", "transaction_code", "paid_amount"], {
        payment_id: "desc"
    });

    if (pg) {
        const [total, rows] = await Promise.all([
            prisma.payment.count({ where }),
            prisma.payment.findMany({
                where,
                include: {
                    order: {
                        select: {
                            order_id: true,
                            order_status: true,
                            total_amount: true,
                            payment_status: true,
                            order_date: true,
                            preferred_payment_method: true,
                            user: {
                                select: { user_id: true, full_name: true, email: true, phone: true }
                            }
                        }
                    }
                },
                orderBy,
                skip: pg.skip,
                take: pg.take
            })
        ]);
        return res.json({ items: serializeBigInt(rows), total });
    }

    const rows = await prisma.payment.findMany({
        where,
        include: {
            order: {
                select: {
                    order_id: true,
                    order_status: true,
                    total_amount: true,
                    payment_status: true,
                    order_date: true,
                    preferred_payment_method: true,
                    user: {
                        select: { user_id: true, full_name: true, email: true, phone: true }
                    }
                }
            }
        },
        orderBy,
        take: 500
    });
    return res.json(serializeBigInt(rows));
}

async function getPayment(req, res) {
    let payment_id;
    try {
        const raw = req.params.id ?? req.params.payment_id;
        payment_id = BigInt(raw);
    } catch {
        return res.status(400).json({ message: "id không hợp lệ" });
    }
    const row = await prisma.payment.findUnique({
        where: { payment_id },
        include: {
            payment_status_logs: { orderBy: { created_at: "desc" }, take: 40 },
            order: {
                include: {
                    user: { select: { user_id: true, full_name: true, email: true, phone: true } },
                    order_items: {
                        include: {
                            product: { select: { product_id: true, product_name: true, sku: true } }
                        }
                    },
                    payments: { orderBy: { payment_id: "desc" } },
                    refund_requests: { orderBy: { refund_request_id: "desc" }, take: 12 }
                }
            }
        }
    });
    if (!row) return res.status(404).json({ message: "Payment not found" });
    return res.json(serializeBigInt(row));
}

async function updatePayment(req, res) {
    const payment_id = BigInt(req.params.payment_id);
    const existing = await prisma.payment.findUnique({ where: { payment_id } });
    if (!existing) return res.status(404).json({ message: "Payment not found" });

    const {
        payment_status,
        transaction_code,
        paid_at,
        paid_amount,
        payment_gateway,
        currency,
        refund_amount,
        gateway_response,
        failure_reason
    } = req.body;
    const data = {};
    if (payment_status !== undefined) {
        const ps = String(payment_status).toLowerCase();
        if (!isAllowedPaymentStatus(ps)) {
            return res.status(400).json({
                message: `payment_status phải là một trong: ${ALLOWED_PAYMENT_STATUSES.join(", ")}`
            });
        }
        const gate = assertAdminCannotMarkGatewayPaidWithoutFlow(existing, payment_status);
        if (!gate.ok) {
            return res.status(400).json({ message: gate.message });
        }
        data.payment_status = String(payment_status);
    }
    if (transaction_code !== undefined) {
        data.transaction_code = transaction_code === null || transaction_code === "" ? null : String(transaction_code);
    }
    if (paid_at !== undefined) {
        data.paid_at = paid_at ? new Date(paid_at) : null;
    }
    if (paid_amount !== undefined) {
        if (paid_amount === null || paid_amount === "") {
            data.paid_amount = null;
        } else {
            const n = Number(paid_amount);
            if (!Number.isFinite(n) || n < 0) {
                return res.status(400).json({ message: "paid_amount phải là số ≥ 0 hoặc để trống" });
            }
            data.paid_amount = n;
        }
    }
    if (payment_gateway !== undefined) {
        data.payment_gateway = payment_gateway === null || payment_gateway === "" ? null : String(payment_gateway);
    }
    if (currency !== undefined) {
        data.currency = currency === null || currency === "" ? null : String(currency);
    }
    if (failure_reason !== undefined) {
        data.failure_reason = failure_reason === null || failure_reason === "" ? null : String(failure_reason);
    }
    if (gateway_response !== undefined) {
        data.gateway_response =
            gateway_response === null || gateway_response === "" ? null : gateway_response;
    }
    if (refund_amount !== undefined) {
        if (refund_amount === null || refund_amount === "") {
            data.refund_amount = null;
        } else {
            const n = Number(refund_amount);
            if (!Number.isFinite(n) || n < 0) {
                return res.status(400).json({ message: "refund_amount phải là số ≥ 0 hoặc để trống" });
            }
            data.refund_amount = n;
        }
    }

    if (Object.keys(data).length === 0) {
        return res.status(400).json({
            message:
                "Cần ít nhất một trường: payment_status, transaction_code, paid_at, paid_amount, payment_gateway, currency, refund_amount, gateway_response, failure_reason"
        });
    }

    const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.payment.update({
            where: { payment_id },
            data
        });
        if (data.payment_status !== undefined && existing.payment_status !== u.payment_status) {
            await appendPaymentStatusLog({
                tx,
                order_id: existing.order_id,
                payment_id,
                from_status: existing.payment_status,
                to_status: u.payment_status,
                source: "admin",
                note: "Cập nhật giao dịch thanh toán"
            });
            const ord = await tx.order.findUnique({ where: { order_id: u.order_id } });
            if (ord && ord.payment_status !== u.payment_status) {
                await tx.order.update({
                    where: { order_id: u.order_id },
                    data: { payment_status: u.payment_status }
                });
                await appendPaymentStatusLog({
                    tx,
                    order_id: u.order_id,
                    payment_id: null,
                    from_status: ord.payment_status,
                    to_status: u.payment_status,
                    source: "admin",
                    note: `Đồng bộ đơn hàng theo giao dịch #${asId(payment_id)}`
                });
            }
        } else {
            const st = String(u.payment_status || "").toLowerCase();
            const manualMethods = ["cod", "bank_transfer"];
            const manualPaid = st === PAYMENT_LINE_SUCCESS || st === "paid";
            if (manualPaid && manualMethods.includes(String(u.payment_method).toLowerCase())) {
                const ord = await tx.order.findUnique({ where: { order_id: u.order_id } });
                if (ord && ord.payment_status !== "paid") {
                    await tx.order.update({
                        where: { order_id: u.order_id },
                        data: { payment_status: "paid" }
                    });
                    await appendPaymentStatusLog({
                        tx,
                        order_id: u.order_id,
                        payment_id: null,
                        from_status: ord.payment_status,
                        to_status: "paid",
                        source: "admin",
                        note: `Đồng bộ đơn (COD/chuyển khoản) — giao dịch #${asId(payment_id)}`
                    });
                }
            }
        }
        return u;
    });
    return res.json(serializeBigInt(updated));
}

async function listWarranties(req, res) {
    const pg = parsePagination(req, { defaultLimit: 20, maxLimit: 100 });
    const orderBy = parseSort(req, ["warranty_id", "start_date", "end_date", "status", "created_at"], {
        warranty_id: "desc"
    });
    if (pg) {
        const [total, warranties] = await Promise.all([
            prisma.warranty.count(),
            prisma.warranty.findMany({
                include: WARRANTY_LIST_INCLUDE,
                orderBy,
                skip: pg.skip,
                take: pg.take
            })
        ]);
        return res.json({ items: warranties.map(serializeAdminWarrantyItem), total });
    }
    const warranties = await prisma.warranty.findMany({
        include: WARRANTY_LIST_INCLUDE,
        orderBy
    });
    return res.json(warranties.map(serializeAdminWarrantyItem));
}

async function updateWarranty(req, res) {
    const warranty_id = BigInt(req.params.warranty_id);
    const existing = await prisma.warranty.findUnique({ where: { warranty_id } });
    if (!existing) return res.status(404).json({ message: "Warranty not found" });
    const { status, admin_note } = req.body;
    const data = {};
    if (status !== undefined) {
        const st = String(status);
        if (!ALLOWED_WARRANTY_STATUSES.includes(st)) {
            return res.status(400).json({
                message: `status không hợp lệ (dùng: ${ALLOWED_WARRANTY_STATUSES.join(", ")})`
            });
        }
        data.status = st;
    }
    if (admin_note !== undefined) {
        data.admin_note = admin_note === null || admin_note === "" ? null : String(admin_note);
    }
    if (Object.keys(data).length === 0) {
        return res.status(400).json({ message: "Cần ít nhất một trường: status hoặc admin_note." });
    }
    await prisma.warranty.update({ where: { warranty_id }, data });
    const full = await prisma.warranty.findUnique({
        where: { warranty_id },
        include: WARRANTY_LIST_INCLUDE
    });
    return res.json(serializeAdminWarrantyItem(full));
}

async function listRepairRequests(req, res) {
    const { q, status, dateFrom, dateTo, warranty: warrantyFilter } = req.query;
    const and = [];

    if (status && REPAIR_STATUSES.includes(String(status))) {
        and.push({ repair_status: String(status) });
    }

    if (dateFrom || dateTo) {
        const rd = {};
        if (dateFrom) rd.gte = new Date(String(dateFrom));
        if (dateTo) {
            const end = new Date(String(dateTo));
            end.setUTCHours(23, 59, 59, 999);
            rd.lte = end;
        }
        and.push({ request_date: rd });
    }

    if (warrantyFilter === "active") {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        and.push({
            warranty: {
                status: "active",
                end_date: { gte: today }
            }
        });
    } else if (warrantyFilter === "expired") {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        and.push({
            OR: [
                { warranty: { status: "expired" } },
                { warranty: { status: "void" } },
                {
                    warranty: {
                        status: "active",
                        end_date: { lt: today }
                    }
                }
            ]
        });
    }

    const term = q != null ? String(q).trim() : "";
    if (term) {
        const or = [
            { issue_description: { contains: term, mode: "insensitive" } },
            { user: { full_name: { contains: term, mode: "insensitive" } } },
            { user: { email: { contains: term, mode: "insensitive" } } },
            {
                warranty: {
                    order_item: {
                        product: { product_name: { contains: term, mode: "insensitive" } }
                    }
                }
            }
        ];
        if (/^\d+$/.test(term)) {
            try {
                or.push({ repair_request_id: BigInt(term) });
            } catch (_) {
                /* ignore */
            }
        }
        and.push({ OR: or });
    }

    const where = and.length ? { AND: and } : {};

    const pg = parsePagination(req, { defaultLimit: 20, maxLimit: 100 });
    const orderBy = parseSort(req, ["repair_request_id", "request_date", "repair_status"], {
        repair_request_id: "desc"
    });

    if (pg) {
        const [total, items] = await Promise.all([
            prisma.repairRequest.count({ where }),
            prisma.repairRequest.findMany({
                where,
                include: repairInclude,
                orderBy,
                skip: pg.skip,
                take: pg.take
            })
        ]);
        return res.json({ items: items.map((rr) => serializeBigInt(rr)), total });
    }

    const items = await prisma.repairRequest.findMany({
        where,
        include: repairInclude,
        orderBy
    });
    return res.json(items.map((rr) => serializeBigInt(rr)));
}

async function getRepairRequest(req, res) {
    const repair_request_id = BigInt(req.params.repair_request_id);
    const rr = await prisma.repairRequest.findUnique({
        where: { repair_request_id },
        include: repairInclude
    });
    if (!rr) return res.status(404).json({ message: "Không tìm thấy yêu cầu sửa chữa." });
    return res.json(serializeBigInt(rr));
}

async function updateRepairRequest(req, res) {
    const repair_request_id = BigInt(req.params.repair_request_id);
    const existing = await prisma.repairRequest.findUnique({ where: { repair_request_id } });
    if (!existing) return res.status(404).json({ message: "Repair request not found" });

    const {
        repair_status,
        admin_notes,
        resolution_notes,
        expected_completion_date,
        completed_at
    } = req.body;

    const data = {};

    if (repair_status !== undefined) {
        if (!REPAIR_STATUSES.includes(String(repair_status))) {
            return res.status(400).json({ message: "Trạng thái không hợp lệ." });
        }
        data.repair_status = String(repair_status);
    }

    if (admin_notes !== undefined) {
        data.admin_notes = admin_notes === null || admin_notes === "" ? null : String(admin_notes);
    }
    if (resolution_notes !== undefined) {
        data.resolution_notes = resolution_notes === null || resolution_notes === "" ? null : String(resolution_notes);
    }
    if (expected_completion_date !== undefined) {
        data.expected_completion_date = expected_completion_date
            ? new Date(String(expected_completion_date))
            : null;
    }
    if (completed_at !== undefined) {
        data.completed_at = completed_at ? new Date(String(completed_at)) : null;
    }

    const nextStatus = data.repair_status !== undefined ? data.repair_status : existing.repair_status;
    if (
        (nextStatus === "completed" || nextStatus === "repaired") &&
        data.completed_at === undefined &&
        completed_at === undefined &&
        !existing.completed_at
    ) {
        data.completed_at = new Date();
    }

    if (Object.keys(data).length === 0) {
        return res.status(400).json({ message: "Không có dữ liệu cập nhật." });
    }

    const updated = await prisma.repairRequest.update({
        where: { repair_request_id },
        data
    });
    const full = await prisma.repairRequest.findUnique({
        where: { repair_request_id },
        include: repairInclude
    });
    return res.json(serializeBigInt(full));
}

async function listRefundRequests(req, res) {
    const pg = parsePagination(req, { defaultLimit: 20, maxLimit: 100 });
    const orderBy = parseSort(req, ["refund_request_id", "request_date", "refund_status", "refund_amount", "order_id"], {
        refund_request_id: "desc"
    });
    if (pg) {
        const [total, items] = await Promise.all([
            prisma.refundRequest.count(),
            prisma.refundRequest.findMany({
                include: {
                    user: { select: { user_id: true, full_name: true, email: true } },
                    order: {
                        select: {
                            order_id: true,
                            user_id: true,
                            order_date: true,
                            order_status: true,
                            total_amount: true,
                            payment_status: true
                        }
                    }
                },
                orderBy,
                skip: pg.skip,
                take: pg.take
            })
        ]);
        return res.json({
            items: items.map((r) => ({
                refund_request_id: asId(r.refund_request_id),
                order_id: asId(r.order_id),
                user_id: asId(r.user_id),
                request_date: r.request_date,
                reason: r.reason,
                buyer_note: r.buyer_note,
                admin_note: r.admin_note,
                refund_amount: r.refund_amount != null ? String(r.refund_amount) : null,
                refund_status: r.refund_status,
                user: r.user
                    ? {
                          user_id: asId(r.user.user_id),
                          full_name: r.user.full_name,
                          email: r.user.email
                      }
                    : null,
                order: r.order
                    ? {
                          order_id: asId(r.order.order_id),
                          user_id: asId(r.order.user_id),
                          order_date: r.order.order_date,
                          order_status: r.order.order_status,
                          total_amount: r.order.total_amount != null ? String(r.order.total_amount) : null,
                          payment_status: r.order.payment_status
                      }
                    : null
            })),
            total
        });
    }

    const items = await prisma.refundRequest.findMany({
        include: {
            user: { select: { user_id: true, full_name: true, email: true } },
            order: {
                select: {
                    order_id: true,
                    user_id: true,
                    order_date: true,
                    order_status: true,
                    total_amount: true,
                    payment_status: true
                }
            }
        },
        orderBy
    });
    return res.json(
        items.map((r) => ({
            refund_request_id: asId(r.refund_request_id),
            order_id: asId(r.order_id),
            user_id: asId(r.user_id),
            request_date: r.request_date,
            reason: r.reason,
            buyer_note: r.buyer_note,
            admin_note: r.admin_note,
            refund_amount: r.refund_amount != null ? String(r.refund_amount) : null,
            refund_status: r.refund_status,
            user: r.user
                ? {
                      user_id: asId(r.user.user_id),
                      full_name: r.user.full_name,
                      email: r.user.email
                  }
                : null,
            order: r.order
                ? {
                      order_id: asId(r.order.order_id),
                      user_id: asId(r.order.user_id),
                      order_date: r.order.order_date,
                      order_status: r.order.order_status,
                      total_amount: r.order.total_amount != null ? String(r.order.total_amount) : null,
                      payment_status: r.order.payment_status
                  }
                : null
        }))
    );
}

async function updateRefundRequest(req, res) {
    const refund_request_id = BigInt(req.params.refund_request_id);
    const existing = await prisma.refundRequest.findUnique({
        where: { refund_request_id },
        include: { order: { select: { total_amount: true } } }
    });
    if (!existing) return res.status(404).json({ message: "Refund request not found" });
    const { refund_status, admin_note, refund_amount } = req.body;
    if (refund_status !== undefined) {
        const st = String(refund_status);
        if (!ALLOWED_REFUND_STATUSES.includes(st)) {
            return res.status(400).json({
                message: `refund_status không hợp lệ (dùng: ${ALLOWED_REFUND_STATUSES.join(", ")})`
            });
        }
    }
    const data = {};
    if (refund_status !== undefined) data.refund_status = String(refund_status);
    if (admin_note !== undefined) {
        const t = admin_note === null || admin_note === "" ? null : String(admin_note).trim();
        data.admin_note = t || null;
    }
    if (refund_amount !== undefined) {
        const n = Number(refund_amount);
        if (Number.isNaN(n) || n < 0) {
            return res.status(400).json({ message: "refund_amount phải là số ≥ 0." });
        }
        const cap = existing.order?.total_amount != null ? Number(existing.order.total_amount) : null;
        if (cap != null && n > cap) {
            return res.status(400).json({
                message: `Số tiền hoàn không được vượt tổng đơn (${cap}).`
            });
        }
        data.refund_amount = n;
    }
    if (Object.keys(data).length === 0) {
        return res.status(400).json({ message: "Gửi refund_status, admin_note hoặc refund_amount." });
    }

    const nextRefundStatus = data.refund_status != null ? String(data.refund_status) : null;

    const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.refundRequest.update({
            where: { refund_request_id },
            data
        });
        if (nextRefundStatus === "completed") {
            await tx.order.update({
                where: { order_id: existing.order_id },
                data: { payment_status: "refunded" }
            });
            await tx.payment.updateMany({
                where: {
                    order_id: existing.order_id,
                    payment_status: { in: [PAYMENT_LINE_SUCCESS, "paid"] }
                },
                data: { payment_status: "refunded" }
            });
        }
        return u;
    });
    return res.json({
        refund_request_id: asId(updated.refund_request_id),
        order_id: asId(updated.order_id),
        user_id: asId(updated.user_id),
        request_date: updated.request_date,
        reason: updated.reason,
        buyer_note: updated.buyer_note,
        admin_note: updated.admin_note,
        refund_amount: updated.refund_amount != null ? String(updated.refund_amount) : null,
        refund_status: updated.refund_status
    });
}

async function reportSummary(req, res) {
    const { from, to } = req.query;
    const toDate = to ? new Date(String(to)) : new Date();
    const fromDate = from ? new Date(String(from)) : new Date(Date.now() - 30 * 86400 * 1000);

    if (Number.isNaN(toDate.getTime()) || Number.isNaN(fromDate.getTime())) {
        return res.status(400).json({ message: "Tham số from/to không hợp lệ (dùng định dạng ngày ISO)." });
    }
    if (fromDate > toDate) {
        return res.status(400).json({ message: "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc." });
    }

    const [
        customersRegistered,
        productsCatalog,
        revenueRows,
        ordersInPeriod,
        buyerRows,
        statusRows,
        voucherRows,
        repairCount,
        refundCount
    ] = await Promise.all([
        prisma.user.count(),
        prisma.product.count(),
        prisma.$queryRawUnsafe(
            `SELECT COALESCE(SUM(total_amount), 0)::text AS revenue
             FROM orders
             WHERE order_date >= $1 AND order_date <= $2
               AND payment_status IN ('paid')`,
            fromDate,
            toDate
        ),
        prisma.order.count({
            where: { order_date: { gte: fromDate, lte: toDate } }
        }),
        prisma.$queryRawUnsafe(
            `SELECT COUNT(DISTINCT user_id)::int AS n
             FROM orders
             WHERE order_date >= $1 AND order_date <= $2`,
            fromDate,
            toDate
        ),
        prisma.$queryRawUnsafe(
            `SELECT order_status, COUNT(*)::int AS c
             FROM orders
             WHERE order_date >= $1 AND order_date <= $2
             GROUP BY order_status`,
            fromDate,
            toDate
        ),
        prisma.$queryRawUnsafe(
            `SELECT COUNT(*)::int AS usage_count,
                    COALESCE(SUM(ov.discount_amount), 0)::text AS total_discount
             FROM order_vouchers ov
             INNER JOIN orders o ON o.order_id = ov.order_id
             WHERE o.order_date >= $1 AND o.order_date <= $2`,
            fromDate,
            toDate
        ),
        prisma.repairRequest.count({
            where: { request_date: { gte: fromDate, lte: toDate } }
        }),
        prisma.refundRequest.count({
            where: { request_date: { gte: fromDate, lte: toDate } }
        })
    ]);

    const revenue = Number(revenueRows[0]?.revenue ?? 0);
    const buyersInPeriod = Number(buyerRows[0]?.n ?? 0);
    const voucherUsage = Number(voucherRows[0]?.usage_count ?? 0);
    const voucherDiscount = Number(voucherRows[0]?.total_discount ?? 0);

    const orders_by_status = {};
    for (const row of statusRows) {
        orders_by_status[String(row.order_status)] = row.c;
    }

    return res.json({
        from: fromDate,
        to: toDate,
        kpis: {
            revenue,
            orders_count: ordersInPeriod,
            customers_registered: customersRegistered,
            products_catalog: productsCatalog,
            buyers_in_period: buyersInPeriod
        },
        orders_by_status,
        voucher: {
            usage_count: voucherUsage,
            total_discount: voucherDiscount
        },
        after_sales: {
            repair_requests: repairCount,
            refund_requests: refundCount
        }
    });
}

async function reportRevenue(req, res) {
    const { from, to, groupBy } = req.query;
    const fromDate = from ? new Date(String(from)) : new Date(Date.now() - 30 * 86400 * 1000);
    const toDate = to ? new Date(String(to)) : new Date();
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
        return res.status(400).json({ message: "Tham số from/to không hợp lệ." });
    }
    if (fromDate > toDate) {
        return res.status(400).json({ message: "from phải trước hoặc bằng to." });
    }
    const gb = groupBy === "month" ? "month" : "day";

    // Use Prisma raw due to grouping on date parts
    const rows = await prisma.$queryRawUnsafe(
        gb === "month"
            ? `
            SELECT date_trunc('month', order_date) AS bucket,
                   SUM(total_amount)::text AS revenue
            FROM orders
            WHERE order_date >= $1 AND order_date <= $2
              AND payment_status IN ('paid')
            GROUP BY bucket
            ORDER BY bucket ASC
          `
            : `
            SELECT date_trunc('day', order_date) AS bucket,
                   SUM(total_amount)::text AS revenue
            FROM orders
            WHERE order_date >= $1 AND order_date <= $2
              AND payment_status IN ('paid')
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

const REVIEW_MODERATION_STATUSES = ["pending", "approved", "rejected"];

async function listReviews(req, res) {
    const rawSt = req.query.moderation_status != null ? String(req.query.moderation_status).trim() : "";
    const where = {};
    if (rawSt && rawSt !== "all") {
        if (!REVIEW_MODERATION_STATUSES.includes(rawSt)) {
            return res.status(400).json({
                message: "moderation_status dùng all hoặc pending | approved | rejected"
            });
        }
        where.moderation_status = rawSt;
    }
    const pg = parsePagination(req, { defaultLimit: 20, maxLimit: 100 });
    const orderBy = parseSort(req, ["review_id", "created_at", "rating", "moderation_status"], {
        review_id: "desc"
    });

    if (pg) {
        const [total, reviews] = await Promise.all([
            prisma.review.count({ where }),
            prisma.review.findMany({
                where,
                include: {
                    user: { select: { user_id: true, full_name: true, email: true } },
                    product: { select: { product_id: true, product_name: true, sku: true } },
                    _count: { select: { comments: true } },
                    comments: {
                        take: 12,
                        orderBy: { created_at: "desc" },
                        include: { user: { select: { user_id: true, full_name: true, email: true } } }
                    }
                },
                orderBy,
                skip: pg.skip,
                take: pg.take
            })
        ]);
        return res.json({ items: serializeBigInt(reviews), total });
    }

    const reviews = await prisma.review.findMany({
        where,
        include: {
            user: { select: { user_id: true, full_name: true, email: true } },
            product: { select: { product_id: true, product_name: true, sku: true } },
            _count: { select: { comments: true } },
            comments: {
                take: 12,
                orderBy: { created_at: "desc" },
                include: { user: { select: { user_id: true, full_name: true, email: true } } }
            }
        },
        orderBy
    });
    return res.json(serializeBigInt(reviews));
}

async function updateReviewModeration(req, res) {
    const review_id = BigInt(req.params.review_id);
    const { moderation_status } = req.body;
    const st = moderation_status != null ? String(moderation_status) : "";
    if (!REVIEW_MODERATION_STATUSES.includes(st)) {
        return res.status(400).json({ message: "moderation_status phải là pending | approved | rejected" });
    }
    const existing = await prisma.review.findUnique({ where: { review_id } });
    if (!existing) return res.status(404).json({ message: "Review not found" });
    const updated = await prisma.review.update({
        where: { review_id },
        data: { moderation_status: st }
    });
    return res.json({
        ...updated,
        review_id: asId(updated.review_id),
        user_id: asId(updated.user_id),
        product_id: asId(updated.product_id)
    });
}

async function deleteReview(req, res) {
    const review_id = BigInt(req.params.review_id);
    const existing = await prisma.review.findUnique({ where: { review_id } });
    if (!existing) return res.status(404).json({ message: "Review not found" });
    await prisma.review.delete({ where: { review_id } });
    return res.json({ message: "Review deleted" });
}

async function deleteReviewComment(req, res) {
    const review_comment_id = BigInt(req.params.review_comment_id);
    const existing = await prisma.reviewComment.findUnique({ where: { review_comment_id } });
    if (!existing) return res.status(404).json({ message: "Comment not found" });
    await prisma.reviewComment.delete({ where: { review_comment_id } });
    return res.json({ message: "Comment deleted" });
}

async function reportTopProducts(req, res) {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const { from, to } = req.query;

    if (from && to) {
        const fromDate = new Date(String(from));
        const toDate = new Date(String(to));
        if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
            return res.status(400).json({ message: "from/to không hợp lệ khi lọc top sản phẩm." });
        }
        if (fromDate > toDate) {
            return res.status(400).json({ message: "from phải trước hoặc bằng to." });
        }
        const rows = await prisma.$queryRawUnsafe(
            `
            SELECT p.product_id,
                   p.product_name,
                   SUM(oi.quantity)::int AS total_quantity,
                   SUM(oi.line_total)::text AS total_sales
            FROM order_items oi
            INNER JOIN orders o ON o.order_id = oi.order_id
            JOIN products p ON p.product_id = oi.product_id
            WHERE o.order_date >= $1 AND o.order_date <= $2
              AND o.payment_status IN ('paid')
            GROUP BY p.product_id, p.product_name
            ORDER BY SUM(oi.line_total) DESC
            LIMIT $3
        `,
            fromDate,
            toDate,
            limit
        );
        return res.json({
            limit,
            from: fromDate,
            to: toDate,
            rows: rows.map((r) => ({
                ...r,
                product_id: asId(r.product_id)
            }))
        });
    }

    const rows = await prisma.$queryRawUnsafe(
        `
        SELECT p.product_id,
               p.product_name,
               SUM(oi.quantity)::int AS total_quantity,
               SUM(oi.line_total)::text AS total_sales
        FROM order_items oi
        JOIN products p ON p.product_id = oi.product_id
        GROUP BY p.product_id, p.product_name
        ORDER BY SUM(oi.line_total) DESC
        LIMIT $1
    `,
        limit
    );
    return res.json({
        limit,
        rows: rows.map((r) => ({
            ...r,
            product_id: asId(r.product_id)
        }))
    });
}

module.exports = {
    dashboard,
    listReviews,
    updateReviewModeration,
    deleteReview,
    deleteReviewComment,
    listUsers,
    getUser,
    getUserActivity,
    updateUser,
    listRoles,
    createRole,
    deleteRole,
    listOrders,
    getOrder,
    updateOrderStatus,
    listPayments,
    getPayment,
    updatePayment,
    listWarranties,
    updateWarranty,
    listRepairRequests,
    getRepairRequest,
    updateRepairRequest,
    listRefundRequests,
    updateRefundRequest,
    reportSummary,
    reportRevenue,
    reportTopProducts
};

