const crypto = require("crypto");
const jwt = require("jsonwebtoken");

function parseDurationSeconds(value, fallbackSeconds) {
    if (!value) return fallbackSeconds;
    if (typeof value === "number") return value;
    const s = String(value).trim();
    const m = s.match(/^(\d+)(s|m|h|d)$/i);
    if (!m) return fallbackSeconds;
    const n = Number(m[1]);
    const unit = m[2].toLowerCase();
    if (unit === "s") return n;
    if (unit === "m") return n * 60;
    if (unit === "h") return n * 3600;
    if (unit === "d") return n * 86400;
    return fallbackSeconds;
}

function signAccessToken(payload) {
    const secret = process.env.JWT_SECRET;
    const ttlSeconds = parseDurationSeconds(process.env.ACCESS_TOKEN_TTL, 15 * 60);
    return jwt.sign(payload, secret, { expiresIn: ttlSeconds });
}

function signRefreshToken(payload) {
    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    const ttlSeconds = parseDurationSeconds(process.env.REFRESH_TOKEN_TTL, 7 * 24 * 3600);
    return jwt.sign(payload, secret, { expiresIn: ttlSeconds });
}

function verifyRefreshToken(token) {
    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    return jwt.verify(token, secret);
}

function sha256(input) {
    return crypto.createHash("sha256").update(input).digest("hex");
}

function refreshExpiryDate() {
    const ttlSeconds = parseDurationSeconds(process.env.REFRESH_TOKEN_TTL, 7 * 24 * 3600);
    return new Date(Date.now() + ttlSeconds * 1000);
}

module.exports = {
    signAccessToken,
    signRefreshToken,
    verifyRefreshToken,
    sha256,
    refreshExpiryDate
};

