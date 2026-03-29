const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken } = require("../middleware/authMiddleware");
const reviewController = require("../controllers/reviewController");

const router = express.Router();

router.post(
    "/products/:productId",
    verifyToken,
    asyncHandler(reviewController.create)
);
router.patch("/:id", verifyToken, asyncHandler(reviewController.update));
router.delete("/:id", verifyToken, asyncHandler(reviewController.remove));

module.exports = router;

