const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken, authorizeRoles } = require("../middleware/authMiddleware");
const categoryBrandController = require("../controllers/categoryBrandController");

const router = express.Router();

router.get("/", asyncHandler(categoryBrandController.listMap));
router.put(
    "/",
    verifyToken,
    authorizeRoles("admin"),
    asyncHandler(categoryBrandController.setMap)
);

module.exports = router;
