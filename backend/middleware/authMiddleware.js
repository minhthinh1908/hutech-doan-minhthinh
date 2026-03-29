const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Access token is missing" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // normalize (JWT payload is stringified user_id in our implementation)
        if (decoded && decoded.user_id != null) {
            decoded.user_id = String(decoded.user_id);
        }
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
};

const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role_name)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        next();
    };
};

module.exports = { verifyToken, authorizeRoles };