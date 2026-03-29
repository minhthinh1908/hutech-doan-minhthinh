const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const webhookController = require("../controllers/webhookController");

const router = express.Router();

router.post("/payment-gateway", asyncHandler(webhookController.paymentGateway));

module.exports = router;
