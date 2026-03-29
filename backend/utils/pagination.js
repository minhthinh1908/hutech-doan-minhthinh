function parsePagination(query) {
    const page = Math.max(1, Math.floor(Number(query.page) || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(Number(query.limit) || 20)));
    const skip = (page - 1) * limit;
    return { page, limit, skip };
}

module.exports = { parsePagination };

