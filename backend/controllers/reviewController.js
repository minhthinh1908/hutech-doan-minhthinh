const prisma = require("../prisma/client");

async function listByProduct(req, res) {
    const product_id = BigInt(req.params.id);
    const reviews = await prisma.review.findMany({
        where: { product_id },
        include: { user: { select: { user_id: true, full_name: true } } },
        orderBy: { created_at: "desc" }
    });
    return res.json(
        reviews.map((r) => ({
            ...r,
            review_id: r.review_id.toString(),
            user_id: r.user_id.toString(),
            product_id: r.product_id.toString(),
            user: r.user
                ? { ...r.user, user_id: r.user.user_id.toString() }
                : null
        }))
    );
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

    const review = await prisma.review.create({
        data: { user_id, product_id, rating: r, comment: comment || null }
    });
    return res.status(201).json({
        ...review,
        review_id: review.review_id.toString(),
        user_id: review.user_id.toString(),
        product_id: review.product_id.toString()
    });
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
    return res.json({
        ...review,
        review_id: review.review_id.toString(),
        user_id: review.user_id.toString(),
        product_id: review.product_id.toString()
    });
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

module.exports = { listByProduct, create, update, remove };

