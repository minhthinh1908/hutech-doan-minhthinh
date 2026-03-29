const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken, authorizeRoles } = require("../middleware/authMiddleware");
const categoryController = require("../controllers/categoryController");

const router = express.Router();

router.get("/", asyncHandler(categoryController.list));
router.get("/tree", asyncHandler(categoryController.tree));
router.post(
    "/seed-defaults",
    verifyToken,
    authorizeRoles("admin"),
    asyncHandler(categoryController.seedDefaults)
);
router.get("/:id", asyncHandler(categoryController.getById));

// admin
router.post(
    "/",
    verifyToken,
    authorizeRoles("admin"),
    asyncHandler(categoryController.create)
);
router.patch(
    "/:id",
    verifyToken,
    authorizeRoles("admin"),
    asyncHandler(categoryController.update)
);
router.delete(
    "/:id",
    verifyToken,
    authorizeRoles("admin"),
    asyncHandler(categoryController.remove)
);

module.exports = router;

