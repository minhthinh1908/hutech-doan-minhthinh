const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken } = require("../middleware/authMiddleware");
const warrantyController = require("../controllers/warrantyController");

const router = express.Router();

router.get("/", verifyToken, asyncHandler(warrantyController.listMyWarranties));
router.post(
    "/activate/order-items/:order_item_id",
    verifyToken,
    asyncHandler(warrantyController.activateByOrderItem)
);

module.exports = router;

