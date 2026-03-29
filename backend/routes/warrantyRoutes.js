const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken } = require("../middleware/authMiddleware");
const warrantyController = require("../controllers/warrantyController");

const router = express.Router();

router.get("/", verifyToken, asyncHandler(warrantyController.listMyWarranties));

module.exports = router;

