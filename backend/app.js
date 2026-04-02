const path = require("path");
const fs = require("fs");
const express = require("express");
const authRoutes = require("./routes/authRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const brandRoutes = require("./routes/brandRoutes");
const categoryBrandRoutes = require("./routes/categoryBrandRoutes");
const productRoutes = require("./routes/productRoutes");
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");
const voucherRoutes = require("./routes/voucherRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const warrantyRoutes = require("./routes/warrantyRoutes");
const repairRoutes = require("./routes/repairRoutes");
const refundRoutes = require("./routes/refundRoutes");
const adminRoutes = require("./routes/adminRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const webhookRoutes = require("./routes/webhookRoutes");
const siteFooterRoutes = require("./routes/siteFooterRoutes");
const cmsPageRoutes = require("./routes/cmsPageRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

const requestBodyLimit = process.env.REQUEST_BODY_LIMIT || "10mb";
app.use(express.json({ limit: requestBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: requestBodyLimit }));

const uploadsPath = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });
app.use("/uploads", express.static(uploadsPath));

app.get("/", (req, res) => {
    res.json({ message: "E-commerce test API is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/category-brands", categoryBrandRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/vouchers", voucherRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/warranties", warrantyRoutes);
app.use("/api/repair-requests", repairRoutes);
app.use("/api/refund-requests", refundRoutes);
app.use("/api/site-footer", siteFooterRoutes);
app.use("/api/cms-pages", cmsPageRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/webhooks", webhookRoutes);

app.use(errorHandler);

module.exports = app;