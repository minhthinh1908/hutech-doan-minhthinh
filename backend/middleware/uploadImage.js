const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || "").toLowerCase();
        const safeExt = [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext) ? ext : ".jpg";
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExt}`);
    }
});

function isAllowedImage(file) {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const extOk = [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext);
    const mime = String(file.mimetype || "").toLowerCase();
    const mimeOk = /^image\/(jpeg|jpg|pjpeg|png|gif|webp)$/i.test(mime);
    // Một số trình duyệt / iOS gửi application/octet-stream kèm đuôi .jpg
    if (mimeOk) return true;
    if (extOk && (mime === "application/octet-stream" || mime === "")) return true;
    return false;
}

module.exports = multer({
    storage,
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (isAllowedImage(file)) cb(null, true);
        else cb(new Error("Chỉ chấp nhận ảnh JPEG, PNG, GIF, WebP (tối đa 8MB)"));
    }
});
