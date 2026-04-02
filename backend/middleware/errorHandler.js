function errorHandler(err, req, res, next) {
    // eslint-disable-next-line no-unused-vars
    const _next = next;
    console.error(err);

    if (err.name === "MulterError") {
        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({ message: "Ảnh quá lớn (tối đa 8MB)" });
        }
        return res.status(400).json({ message: err.message || "Lỗi tải tệp" });
    }
    if (typeof err.message === "string" && err.message.includes("Chỉ chấp nhận ảnh")) {
        return res.status(400).json({ message: err.message });
    }

    // Prisma known errors (avoid leaking internals)
    const prismaCode = err && err.code;
    if (prismaCode === "P2002") {
        return res.status(409).json({ message: "Unique constraint failed" });
    }
    if (prismaCode === "P2025") {
        return res.status(404).json({ message: "Record not found" });
    }
    if (prismaCode === "P2022") {
        return res.status(500).json({
            message:
                "Cơ sở dữ liệu thiếu cột (schema lệch). Chạy: node scripts/ensure-product-columns.js trong thư mục backend, hoặc prisma migrate deploy."
        });
    }

    const status = err.statusCode || err.status || 500;
    const message = err.message || "Internal server error";
    return res.status(status).json({
        message,
        ...(process.env.NODE_ENV !== "production" ? { stack: err.stack } : {})
    });
}

module.exports = errorHandler;

