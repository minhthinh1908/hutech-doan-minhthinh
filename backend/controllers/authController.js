const bcrypt = require("bcryptjs");
const prisma = require("../prisma/client");
const {
    signAccessToken,
    signRefreshToken,
    verifyRefreshToken,
    sha256,
    refreshExpiryDate
} = require("../utils/tokens");

const register = async (req, res) => {
    try {
        const { full_name, email, password, phone, role_name } = req.body;

        if (!full_name || !email || !password) {
            return res.status(400).json({
                message: "full_name, email, and password are required"
            });
        }

        const selectedRole = role_name || "buyer";

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return res.status(409).json({ message: "Email already exists" });
        }

        const role = await prisma.role.findFirst({
            where: { role_name: selectedRole }
        });
        if (!role) {
            return res.status(400).json({ message: "Invalid role" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                role_id: role.role_id,
                full_name,
                email,
                password_hash: hashedPassword,
                phone: phone || null
            },
            select: { user_id: true }
        });

        return res.status(201).json({
            message: "User registered successfully",
            user_id: user.user_id.toString()
        });
    } catch (error) {
        console.error("Register error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await prisma.user.findUnique({
            where: { email },
            include: { role: true }
        });
        if (!user) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        if (user.status !== "active") {
            return res.status(403).json({ message: "Account is inactive" });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const accessPayload = {
            user_id: user.user_id.toString(),
            email: user.email,
            role_name: user.role.role_name
        };
        const accessToken = signAccessToken(accessPayload);

        const refreshPayload = {
            user_id: user.user_id.toString(),
            token_type: "refresh"
        };
        const refreshToken = signRefreshToken(refreshPayload);
        const refreshTokenHash = sha256(refreshToken);
        await prisma.refreshToken.create({
            data: {
                user_id: user.user_id,
                token_hash: refreshTokenHash,
                expires_at: refreshExpiryDate()
            }
        });

        return res.json({
            message: "Login successful",
            accessToken,
            refreshToken,
            user: {
                user_id: user.user_id.toString(),
                full_name: user.full_name,
                email: user.email,
                phone: user.phone,
                address: user.address,
                role_name: user.role.role_name
            }
        });
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

const refresh = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ message: "refreshToken is required" });
        }

        let decoded;
        try {
            decoded = verifyRefreshToken(refreshToken);
        } catch {
            return res.status(401).json({ message: "Invalid or expired refresh token" });
        }

        if (!decoded || decoded.token_type !== "refresh" || !decoded.user_id) {
            return res.status(401).json({ message: "Invalid refresh token" });
        }

        const tokenHash = sha256(refreshToken);
        const stored = await prisma.refreshToken.findUnique({
            where: { token_hash: tokenHash }
        });
        if (!stored || stored.revoked_at || stored.expires_at < new Date()) {
            return res.status(401).json({ message: "Refresh token is revoked or expired" });
        }

        const user = await prisma.user.findUnique({
            where: { user_id: BigInt(decoded.user_id) },
            include: { role: true }
        });
        if (!user || user.status !== "active") {
            return res.status(401).json({ message: "User not found or inactive" });
        }

        // rotate: revoke old + issue new refresh
        await prisma.refreshToken.update({
            where: { token_hash: tokenHash },
            data: { revoked_at: new Date() }
        });

        const newAccessToken = signAccessToken({
            user_id: user.user_id.toString(),
            email: user.email,
            role_name: user.role.role_name
        });
        const newRefreshToken = signRefreshToken({
            user_id: user.user_id.toString(),
            token_type: "refresh"
        });
        await prisma.refreshToken.create({
            data: {
                user_id: user.user_id,
                token_hash: sha256(newRefreshToken),
                expires_at: refreshExpiryDate()
            }
        });

        return res.json({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        });
    } catch (error) {
        console.error("Refresh error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

const logout = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ message: "refreshToken is required" });
        }
        const tokenHash = sha256(refreshToken);
        await prisma.refreshToken.updateMany({
            where: { token_hash: tokenHash, revoked_at: null },
            data: { revoked_at: new Date() }
        });
        return res.json({ message: "Logged out" });
    } catch (error) {
        console.error("Logout error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

const profile = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { user_id: BigInt(req.user.user_id) },
            include: { role: true }
        });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        return res.json({
            user_id: user.user_id.toString(),
            full_name: user.full_name,
            email: user.email,
            phone: user.phone,
            address: user.address,
            status: user.status,
            created_at: user.created_at,
            role_name: user.role.role_name
        });
    } catch (error) {
        console.error("Profile error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const updateProfile = async (req, res) => {
    try {
        const uid = BigInt(req.user.user_id);
        const { full_name, phone, email, address } = req.body;
        const data = {};
        if (full_name !== undefined) {
            const fn = String(full_name).trim();
            if (!fn) return res.status(400).json({ message: "Họ tên không được để trống" });
            data.full_name = fn;
        }
        if (phone !== undefined) {
            data.phone = phone === null || phone === "" ? null : String(phone).trim();
        }
        if (address !== undefined) {
            data.address = address === null || address === "" ? null : String(address).trim();
        }
        if (email !== undefined) {
            const em = String(email).trim().toLowerCase();
            if (!em) return res.status(400).json({ message: "Email không được để trống" });
            if (!EMAIL_RE.test(em)) {
                return res.status(400).json({ message: "Email không hợp lệ" });
            }
            const taken = await prisma.user.findFirst({
                where: { email: em, NOT: { user_id: uid } }
            });
            if (taken) {
                return res.status(409).json({ message: "Email đã được tài khoản khác sử dụng" });
            }
            data.email = em;
        }
        if (Object.keys(data).length === 0) {
            return res.status(400).json({ message: "Không có trường nào để cập nhật" });
        }

        const user = await prisma.user.update({
            where: { user_id: uid },
            data,
            include: { role: true }
        });

        return res.json({
            user_id: user.user_id.toString(),
            full_name: user.full_name,
            email: user.email,
            phone: user.phone,
            address: user.address,
            status: user.status,
            created_at: user.created_at,
            role_name: user.role.role_name
        });
    } catch (error) {
        console.error("Update profile error:", error);
        if (error.code === "P2002") {
            return res.status(409).json({ message: "Email đã được sử dụng" });
        }
        return res.status(500).json({ message: "Internal server error" });
    }
};

const adminOnly = async (req, res) => {
    return res.json({
        message: "Welcome Admin",
        current_user: req.user
    });
};

module.exports = {
    register,
    login,
    refresh,
    logout,
    profile,
    updateProfile,
    adminOnly
};