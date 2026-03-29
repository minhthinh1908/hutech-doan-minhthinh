const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken } = require("../middleware/authMiddleware");
const refundController = require("../controllers/refundController");

const router = express.Router();

router.get("/", verifyToken, asyncHandler(refundController.listMine));
router.post(
    "/orders/:order_id",
    verifyToken,
    asyncHandler(refundController.createForOrder)
);

module.exports = router;

