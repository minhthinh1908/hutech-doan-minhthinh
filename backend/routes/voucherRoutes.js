const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken, authorizeRoles } = require("../middleware/authMiddleware");
const voucherController = require("../controllers/voucherController");

const router = express.Router();

// public: check voucher by code
router.get("/code/:code", asyncHandler(voucherController.getByCode));

// buyer: preview discount against current cart
router.post("/preview", verifyToken, asyncHandler(voucherController.preview));

// admin
router.get("/", verifyToken, authorizeRoles("admin"), asyncHandler(voucherController.list));
router.post(
    "/",
    verifyToken,
    authorizeRoles("admin"),
    asyncHandler(voucherController.create)
);
router.patch(
    "/:id",
    verifyToken,
    authorizeRoles("admin"),
    asyncHandler(voucherController.update)
);
router.delete(
    "/:id",
    verifyToken,
    authorizeRoles("admin"),
    asyncHandler(voucherController.remove)
);

module.exports = router;

