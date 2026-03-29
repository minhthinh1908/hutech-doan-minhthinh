const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken, authorizeRoles, optionalVerifyToken } = require("../middleware/authMiddleware");
const productController = require("../controllers/productController");
const reviewController = require("../controllers/reviewController");

const router = express.Router();

router.get("/", asyncHandler(productController.list));
router.get("/:id", asyncHandler(productController.getById));
router.get("/:id/reviews", optionalVerifyToken, asyncHandler(reviewController.listByProduct));

router.post("/", verifyToken, authorizeRoles("admin"), asyncHandler(productController.create));
router.patch(
    "/:id",
    verifyToken,
    authorizeRoles("admin"),
    asyncHandler(productController.update)
);
router.delete(
    "/:id",
    verifyToken,
    authorizeRoles("admin"),
    asyncHandler(productController.remove)
);

module.exports = router;

