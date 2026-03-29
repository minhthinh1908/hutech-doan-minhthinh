const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken } = require("../middleware/authMiddleware");
const paymentApiController = require("../controllers/paymentApiController");

const router = express.Router();

router.get("/gateway/session", verifyToken, asyncHandler(paymentApiController.getGatewaySession));
router.post("/gateway/complete", verifyToken, asyncHandler(paymentApiController.completeGateway));

router.post("/create", verifyToken, asyncHandler(paymentApiController.create));
router.post("/callback", asyncHandler(paymentApiController.callback));
router.get("/:orderId", verifyToken, asyncHandler(paymentApiController.getByOrder));
router.post("/:orderId/retry", verifyToken, asyncHandler(paymentApiController.retry));

module.exports = router;
