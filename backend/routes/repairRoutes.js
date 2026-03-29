const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken } = require("../middleware/authMiddleware");
const uploadImage = require("../middleware/uploadImage");
const repairController = require("../controllers/repairController");

const router = express.Router();

router.get("/", verifyToken, asyncHandler(repairController.listMine));
router.post(
    "/upload",
    verifyToken,
    uploadImage.single("file"),
    asyncHandler(repairController.uploadAttachment)
);
router.post(
    "/warranties/:warranty_id",
    verifyToken,
    asyncHandler(repairController.createForWarranty)
);
router.get("/detail/:repair_request_id", verifyToken, asyncHandler(repairController.getMineById));

module.exports = router;

