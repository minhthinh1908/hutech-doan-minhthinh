const prisma = require("../prisma/client");

const DEFAULT_POLICIES = [
    { label: "Hướng dẫn mua hàng", to: "/gioi-thieu" },
    { label: "Chính sách vận chuyển", to: "/dich-vu" },
    { label: "Chính sách bán hàng tử tế", to: "/lien-he" },
    { label: "Chính sách bảo mật thông tin", to: "/lien-he" }
];

function isSafeMapEmbedUrl(url) {
    if (url == null || String(url).trim() === "") return true;
    try {
        const u = new URL(String(url).trim());
        if (u.protocol !== "https:") return false;
        const h = u.hostname;
        return h === "www.google.com" || h === "google.com" || h.endsWith(".google.com");
    } catch {
        return false;
    }
}

function normalizePolicies(raw) {
    if (raw == null) return DEFAULT_POLICIES;
    let arr = raw;
    if (typeof raw === "string") {
        try {
            arr = JSON.parse(raw);
        } catch {
            return DEFAULT_POLICIES;
        }
    }
    if (!Array.isArray(arr)) return DEFAULT_POLICIES;
    return arr
        .filter((x) => x && typeof x.label === "string" && x.label.trim())
        .map((x) => {
            const o = { label: x.label.trim() };
            if (x.to && String(x.to).trim()) o.to = String(x.to).trim();
            if (x.href && String(x.href).trim()) o.href = String(x.href).trim();
            return o;
        });
}

async function getPublic(req, res) {
    let row = await prisma.siteFooter.findUnique({ where: { id: 1 } });
    if (!row) {
        row = await prisma.siteFooter.create({
            data: {
                id: 1,
                site_name: "BÌNH ĐỊNH TOOLS",
                branch1_label: "Chi nhánh Bình Định:",
                branch1_phone: "0336 634 677",
                branch1_address: "73 Đường Đào Tấn, Phường Nhơn Bình, Thành phố Quy Nhơn, Tỉnh Bình Định",
                branch2_label: "Chi nhánh HCM:",
                branch2_phone: "0981 278 914",
                branch2_address: "2A, đường số 9, phường Phú Lâm, Thành Phố Hồ Chí Minh",
                email: "binhdinhtools@gmail.com",
                website_url: "https://binhdinhtools.vn",
                copyright_line: "© BÌNH ĐỊNH TOOLS",
                policies_json: DEFAULT_POLICIES
            }
        });
    }
    return res.json(row);
}

async function update(req, res) {
    const b = req.body || {};
    const map1 = b.branch1_map_embed_url;
    const map2 = b.branch2_map_embed_url;
    if (!isSafeMapEmbedUrl(map1) || !isSafeMapEmbedUrl(map2)) {
        return res.status(400).json({
            message:
                "URL nhúng bản đồ phải là link https từ Google Maps (embed), ví dụ: https://www.google.com/maps/embed?..."
        });
    }

    const policiesNormalized = normalizePolicies(b.policies_json);

    const data = {
        site_name:
            b.site_name !== undefined
                ? String(b.site_name || "").trim() || "BÌNH ĐỊNH TOOLS"
                : undefined,
        branch1_label: b.branch1_label !== undefined ? (b.branch1_label ? String(b.branch1_label) : null) : undefined,
        branch1_phone: b.branch1_phone !== undefined ? (b.branch1_phone ? String(b.branch1_phone) : null) : undefined,
        branch1_address: b.branch1_address !== undefined ? (b.branch1_address ? String(b.branch1_address) : null) : undefined,
        branch1_map_embed_url:
            b.branch1_map_embed_url !== undefined
                ? b.branch1_map_embed_url
                    ? String(b.branch1_map_embed_url).trim()
                    : null
                : undefined,
        branch2_label: b.branch2_label !== undefined ? (b.branch2_label ? String(b.branch2_label) : null) : undefined,
        branch2_phone: b.branch2_phone !== undefined ? (b.branch2_phone ? String(b.branch2_phone) : null) : undefined,
        branch2_address: b.branch2_address !== undefined ? (b.branch2_address ? String(b.branch2_address) : null) : undefined,
        branch2_map_embed_url:
            b.branch2_map_embed_url !== undefined
                ? b.branch2_map_embed_url
                    ? String(b.branch2_map_embed_url).trim()
                    : null
                : undefined,
        email: b.email !== undefined ? (b.email ? String(b.email).trim() : null) : undefined,
        website_url: b.website_url !== undefined ? (b.website_url ? String(b.website_url).trim() : null) : undefined,
        copyright_line: b.copyright_line !== undefined ? (b.copyright_line ? String(b.copyright_line) : null) : undefined,
        policies_json: b.policies_json !== undefined ? policiesNormalized : undefined
    };

    Object.keys(data).forEach((k) => {
        if (data[k] === undefined) delete data[k];
    });

    const row = await prisma.siteFooter.upsert({
        where: { id: 1 },
        create: {
            id: 1,
            site_name: data.site_name || "BÌNH ĐỊNH TOOLS",
            branch1_label: data.branch1_label ?? null,
            branch1_phone: data.branch1_phone ?? null,
            branch1_address: data.branch1_address ?? null,
            branch1_map_embed_url: data.branch1_map_embed_url ?? null,
            branch2_label: data.branch2_label ?? null,
            branch2_phone: data.branch2_phone ?? null,
            branch2_address: data.branch2_address ?? null,
            branch2_map_embed_url: data.branch2_map_embed_url ?? null,
            email: data.email ?? null,
            website_url: data.website_url ?? null,
            copyright_line: data.copyright_line ?? null,
            policies_json: data.policies_json ?? DEFAULT_POLICIES
        },
        update: data
    });

    return res.json(row);
}

module.exports = { getPublic, update };
