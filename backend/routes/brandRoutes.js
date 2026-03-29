const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken, authorizeRoles } = require("../middleware/authMiddleware");
const brandController = require("../controllers/brandController");

const router = express.Router();

router.get("/", asyncHandler(brandController.list));
router.post(
    "/seed-defaults",
    verifyToken,
    authorizeRoles("admin"),
    asyncHandler(brandController.seedDefaults)
);
router.get("/:id", asyncHandler(brandController.getById));

router.post("/", verifyToken, authorizeRoles("admin"), asyncHandler(brandController.create));
router.patch(
    "/:id",
    verifyToken,
    authorizeRoles("admin"),
    asyncHandler(brandController.update)
);
router.delete(
    "/:id",
    verifyToken,
    authorizeRoles("admin"),
    asyncHandler(brandController.remove)
);

module.exports = router;

