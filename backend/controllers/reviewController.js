const prisma = require("../prisma/client");

function serializeReview(r) {
    const comments = Array.isArray(r.comments)
        ? r.comments.map((c) => ({
              review_comment_id: c.review_comment_id.toString(),
              review_id: c.review_id.toString(),
              user_id: c.user_id.toString(),
              body: c.body,
              created_at: c.created_at,
              user: c.user ? { user_id: c.user.user_id.toString(), full_name: c.user.full_name } : null
          }))
        : undefined;
    return {
        review_id: r.review_id.toString(),
        user_id: r.user_id.toString(),
        product_id: r.product_id.toString(),
        rating: r.rating,
        comment: r.comment,
        moderation_status: r.moderation_status,
        created_at: r.created_at,
        user: r.user ? { user_id: r.user.user_id.toString(), full_name: r.user.full_name } : null,
        ...(comments !== undefined ? { comments } : {})
    };
}

function newReviewModerationStatus() {
    return process.env.REVIEW_MODERATION === "true" || process.env.REVIEW_MODERATION === "1"
        ? "pending"
        : "approved";
}

async function listByProduct(req, res) {
    const product_id = BigInt(req.params.id);
    const uid = req.user?.user_id != null ? BigInt(req.user.user_id) : null;

    const where = {
        product_id,
        OR: [{ moderation_status: "approved" }]
    };
    if (uid != null) {
        where.OR.push({ user_id: uid, moderation_status: { in: ["pending", "rejected"] } });
    }

    const reviews = await prisma.review.findMany({
        where,
        include: {
            user: { select: { user_id: true, full_name: true } },
            comments: {
                include: { user: { select: { user_id: true, full_name: true } } },
                orderBy: { created_at: "asc" }
            }
        },
        orderBy: { created_at: "desc" }
    });

    // Khách: chỉ hiển thị bình luận của các đánh giá đã duyệt (đã lọc ở where)
    const filtered = reviews.map((r) => {
        if (r.moderation_status !== "approved") {
            return { ...r, comments: [] };
        }
        return r;
    });

    return res.json(filtered.map(serializeReview));
}

async function create(req, res) {
    const user_id = BigInt(req.user.user_id);
    const product_id = BigInt(req.params.productId);
    const { rating, comment } = req.body;
    if (rating == null) return res.status(400).json({ message: "rating is required" });
    const r = Number(rating);
    if (!Number.isInteger(r) || r < 1 || r > 5) {
        return res.status(400).json({ message: "rating must be 1..5" });
    }
    const product = await prisma.product.findUnique({ where: { product_id } });
    if (!product) return res.status(404).json({ message: "Product not found" });

    const existing = await prisma.review.findFirst({ where: { user_id, product_id } });
    if (existing) return res.status(409).json({ message: "You already reviewed this product" });

    const moderation_status = newReviewModerationStatus();
    const review = await prisma.review.create({
        data: { user_id, product_id, rating: r, comment: comment || null, moderation_status }
    });
    return res.status(201).json(serializeReview({ ...review, user: null, comments: [] }));
}

async function update(req, res) {
    const user_id = BigInt(req.user.user_id);
    const id = BigInt(req.params.id);
    const existing = await prisma.review.findUnique({ where: { review_id: id } });
    if (!existing) return res.status(404).json({ message: "Review not found" });
    if (existing.user_id !== user_id && req.user.role_name !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
    }
    const data = {};
    if (req.body.rating !== undefined) {
        const r = Number(req.body.rating);
        if (!Number.isInteger(r) || r < 1 || r > 5) {
            return res.status(400).json({ message: "rating must be 1..5" });
        }
        data.rating = r;
    }
    if (req.body.comment !== undefined) data.comment = req.body.comment;
    const review = await prisma.review.update({ where: { review_id: id }, data });
    return res.json(serializeReview({ ...review, user: null, comments: [] }));
}

async function remove(req, res) {
    const user_id = BigInt(req.user.user_id);
    const id = BigInt(req.params.id);
    const existing = await prisma.review.findUnique({ where: { review_id: id } });
    if (!existing) return res.status(404).json({ message: "Review not found" });
    if (existing.user_id !== user_id && req.user.role_name !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
    }
    await prisma.review.delete({ where: { review_id: id } });
    return res.json({ message: "Review deleted" });
}

async function createComment(req, res) {
    const user_id = BigInt(req.user.user_id);
    const review_id = BigInt(req.params.reviewId);
    const body = req.body?.body != null ? String(req.body.body).trim() : "";
    if (!body) return res.status(400).json({ message: "body is required" });
    if (body.length > 4000) return res.status(400).json({ message: "body too long" });

    const review = await prisma.review.findUnique({ where: { review_id } });
    if (!review) return res.status(404).json({ message: "Review not found" });
    if (review.moderation_status !== "approved") {
        return res.status(403).json({ message: "Cannot comment on this review" });
    }

    const row = await prisma.reviewComment.create({
        data: { review_id, user_id, body },
        include: { user: { select: { user_id: true, full_name: true } } }
    });
    return res.status(201).json({
        ...row,
        review_comment_id: row.review_comment_id.toString(),
        review_id: row.review_id.toString(),
        user_id: row.user_id.toString(),
        user: row.user ? { ...row.user, user_id: row.user.user_id.toString() } : null
    });
}

async function removeComment(req, res) {
    const user_id = BigInt(req.user.user_id);
    const comment_id = BigInt(req.params.commentId);
    const existing = await prisma.reviewComment.findUnique({ where: { review_comment_id: comment_id } });
    if (!existing) return res.status(404).json({ message: "Comment not found" });
    if (existing.user_id !== user_id && req.user.role_name !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
    }
    await prisma.reviewComment.delete({ where: { review_comment_id: comment_id } });
    return res.json({ message: "Comment deleted" });
}

module.exports = {
    listByProduct,
    create,
    update,
    remove,
    createComment,
    removeComment
};
