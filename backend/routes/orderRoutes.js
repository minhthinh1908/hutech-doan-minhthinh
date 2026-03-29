const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken } = require("../middleware/authMiddleware");
const orderController = require("../controllers/orderController");

const router = express.Router();

router.post("/", verifyToken, asyncHandler(orderController.checkout));
router.get("/", verifyToken, asyncHandler(orderController.listMyOrders));
router.get("/:id", verifyToken, asyncHandler(orderController.getMyOrder));

router.post("/:id/payments", verifyToken, asyncHandler(orderController.createPayment));
router.get("/:id/payments", verifyToken, asyncHandler(orderController.listPayments));

module.exports = router;

