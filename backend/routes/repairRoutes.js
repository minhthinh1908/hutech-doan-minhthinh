const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken } = require("../middleware/authMiddleware");
const repairController = require("../controllers/repairController");

const router = express.Router();

router.get("/", verifyToken, asyncHandler(repairController.listMine));
router.post(
    "/warranties/:warranty_id",
    verifyToken,
    asyncHandler(repairController.createForWarranty)
);

module.exports = router;

