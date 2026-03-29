const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken, authorizeRoles } = require("../middleware/authMiddleware");
const adminController = require("../controllers/adminController");
const siteFooterController = require("../controllers/siteFooterController");
const uploadImage = require("../middleware/uploadImage");

const router = express.Router();

router.use(verifyToken, authorizeRoles("admin"));

router.get("/dashboard", asyncHandler(adminController.dashboard));

router.get("/users", asyncHandler(adminController.listUsers));
router.patch("/users/:user_id", asyncHandler(adminController.updateUser));

router.get("/roles", asyncHandler(adminController.listRoles));
router.post("/roles", asyncHandler(adminController.createRole));
router.delete("/roles/:role_id", asyncHandler(adminController.deleteRole));

router.get("/orders", asyncHandler(adminController.listOrders));
router.patch("/orders/:order_id", asyncHandler(adminController.updateOrderStatus));

router.patch("/payments/:payment_id", asyncHandler(adminController.updatePayment));

router.get("/warranties", asyncHandler(adminController.listWarranties));
router.patch("/warranties/:warranty_id", asyncHandler(adminController.updateWarranty));

router.get("/repair-requests", asyncHandler(adminController.listRepairRequests));
router.patch(
    "/repair-requests/:repair_request_id",
    asyncHandler(adminController.updateRepairRequest)
);

router.get("/refund-requests", asyncHandler(adminController.listRefundRequests));
router.patch(
    "/refund-requests/:refund_request_id",
    asyncHandler(adminController.updateRefundRequest)
);

router.get("/reports/revenue", asyncHandler(adminController.reportRevenue));
router.get("/reports/top-products", asyncHandler(adminController.reportTopProducts));

router.patch("/site-footer", asyncHandler(siteFooterController.update));

/** POST multipart field "file" — admin only; lưu vào /uploads, trả { url } */
router.post(
    "/upload-image",
    uploadImage.single("file"),
    asyncHandler((req, res) => {
        if (!req.file) {
            return res.status(400).json({ message: "Không có tệp ảnh" });
        }
        res.json({ url: `/uploads/${req.file.filename}` });
    })
);

module.exports = router;

