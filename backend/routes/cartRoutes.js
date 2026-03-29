const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken } = require("../middleware/authMiddleware");
const cartController = require("../controllers/cartController");

const router = express.Router();

router.get("/", verifyToken, asyncHandler(cartController.getMyCart));
router.post("/items", verifyToken, asyncHandler(cartController.addItem));
router.patch(
    "/items/:cart_item_id",
    verifyToken,
    asyncHandler(cartController.updateItem)
);
router.delete(
    "/items/:cart_item_id",
    verifyToken,
    asyncHandler(cartController.removeItem)
);

module.exports = router;

