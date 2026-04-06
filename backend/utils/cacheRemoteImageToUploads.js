const fs = require("fs");
const path = require("path");

/** Chỉ cho phép host seed tin cậy — tránh SSRF nếu gọi từ input khác */
const ALLOWED_HOSTS = new Set(["imgs.dewaltvietnam.com", "images.unsplash.com"]);

/**
 * Tải ảnh HTTPS về backend/uploads và trả URL tương đối /uploads/...
 * Giống ảnh bạn upload trong Admin → trình duyệt không phụ thuộc CDN ngoài / hotlink.
 *
 * @param {string} imageUrl
 * @param {string} filename tên file an toàn, ví dụ seed-dewalt-dcd778.jpg
 * @returns {Promise<string>} ví dụ /uploads/seed-dewalt-dcd778.jpg
 */
async function cacheRemoteImageToUploads(imageUrl, filename) {
  if (!filename || !/^[a-zA-Z0-9._-]+$/.test(filename)) {
    throw new Error("invalid filename");
  }
  const u = new URL(imageUrl);
  if (u.protocol !== "https:" || !ALLOWED_HOSTS.has(u.hostname)) {
    throw new Error(`host not allowed: ${u.hostname}`);
  }

  const uploadDir = path.join(__dirname, "../uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  const dest = path.join(uploadDir, filename);
  if (fs.existsSync(dest)) {
    return `/uploads/${filename}`;
  }

  const res = await fetch(imageUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"
    },
    redirect: "follow"
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 200) {
    throw new Error("response too small");
  }
  fs.writeFileSync(dest, buf);
  return `/uploads/${filename}`;
}

module.exports = { cacheRemoteImageToUploads, ALLOWED_HOSTS };
