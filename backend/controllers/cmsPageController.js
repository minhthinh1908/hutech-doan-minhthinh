const prisma = require("../prisma/client");
const sanitizeHtml = require("sanitize-html");

const ALLOWED_SLUGS = ["gioi-thieu", "dich-vu", "tin-tuc"];

const SANITIZE_OPTIONS = {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2", "h3", "span", "figure", "figcaption"]),
    allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        img: ["src", "alt", "width", "height", "loading"],
        a: ["href", "name", "target", "rel"],
        "*": ["class"]
    },
    allowedSchemesByTag: {
        img: ["http", "https", "data", ""],
        a: ["http", "https", "mailto", ""]
    },
    transformTags: {
        a: (tagName, attribs) => {
            if (attribs.target === "_blank" && !attribs.rel) {
                attribs.rel = "noopener noreferrer";
            }
            return { tagName, attribs };
        }
    }
};

function serializeCmsPage(row) {
    if (!row) return row;
    return {
        ...row,
        cms_page_id: row.cms_page_id != null ? String(row.cms_page_id) : null
    };
}

function sanitizeBody(html) {
    return sanitizeHtml(String(html ?? ""), SANITIZE_OPTIONS);
}

function isValidSlug(slug) {
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(slug || ""));
}

/** P2021 = bảng chưa tạo (chưa migrate / db push) */
function missingTableMessage() {
    return {
        message:
            "Cơ sở dữ liệu chưa có bảng cms_pages. Trong thư mục backend chạy: npx prisma db push (hoặc npx prisma migrate deploy)."
    };
}

async function getPublic(req, res) {
    const slug = String(req.params.slug || "").trim();
    if (!slug) {
        return res.status(404).json({ message: "Không tìm thấy trang" });
    }
    try {
        const row = await prisma.cmsPage.findUnique({ where: { slug } });
        if (!row) {
            return res.status(404).json({ message: "Chưa có nội dung" });
        }
        return res.json({
            slug: row.slug,
            title: row.title,
            body_html: row.body_html,
            updated_at: row.updated_at
        });
    } catch (e) {
        if (e && e.code === "P2021") {
            return res.status(503).json(missingTableMessage());
        }
        throw e;
    }
}

async function listAdmin(req, res) {
    try {
        const rows = await prisma.cmsPage.findMany({
            where: { slug: { not: "" } },
            orderBy: { slug: "asc" }
        });
        return res.json(rows.map(serializeCmsPage));
    } catch (e) {
        if (e && e.code === "P2021") {
            return res.status(503).json(missingTableMessage());
        }
        throw e;
    }
}

async function upsertAdmin(req, res) {
    const slug = String(req.params.slug || "").trim();
    if (!isValidSlug(slug)) {
        return res.status(400).json({ message: "Slug không hợp lệ" });
    }
    const title = req.body?.title;
    if (title == null || String(title).trim() === "") {
        return res.status(400).json({ message: "Cần tiêu đề" });
    }
    const body_html = sanitizeBody(req.body?.body_html);
    try {
        const row = await prisma.cmsPage.upsert({
            where: { slug },
            create: {
                slug,
                title: String(title).trim(),
                body_html
            },
            update: {
                title: String(title).trim(),
                body_html
            }
        });
        return res.json(serializeCmsPage(row));
    } catch (e) {
        if (e && e.code === "P2021") {
            return res.status(503).json(missingTableMessage());
        }
        throw e;
    }
}

module.exports = {
    ALLOWED_SLUGS,
    getPublic,
    listAdmin,
    upsertAdmin
};
