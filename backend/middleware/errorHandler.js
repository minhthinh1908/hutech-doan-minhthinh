function errorHandler(err, req, res, next) {
    // eslint-disable-next-line no-unused-vars
    const _next = next;
    console.error(err);

    // Prisma known errors (avoid leaking internals)
    const prismaCode = err && err.code;
    if (prismaCode === "P2002") {
        return res.status(409).json({ message: "Unique constraint failed" });
    }
    if (prismaCode === "P2025") {
        return res.status(404).json({ message: "Record not found" });
    }

    const status = err.statusCode || err.status || 500;
    const message = err.message || "Internal server error";
    return res.status(status).json({
        message,
        ...(process.env.NODE_ENV !== "production" ? { stack: err.stack } : {})
    });
}

module.exports = errorHandler;

