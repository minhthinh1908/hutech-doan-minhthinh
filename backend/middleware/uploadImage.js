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

module.exports = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (/^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype)) cb(null, true);
        else cb(new Error("Chỉ chấp nhận ảnh JPEG, PNG, GIF, WebP"));
    }
});
