const express = require("express");
const router = express.Router();

const {
    register,
    login,
    refresh,
    logout,
    profile,
    updateProfile,
    adminOnly
} = require("../controllers/authController");

const {
    verifyToken,
    authorizeRoles
} = require("../middleware/authMiddleware");

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", verifyToken, profile);
router.patch("/me", verifyToken, updateProfile);
router.get("/admin", verifyToken, authorizeRoles("admin"), adminOnly);

module.exports = router;