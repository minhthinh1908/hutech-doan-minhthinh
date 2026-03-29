const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const siteFooterController = require("../controllers/siteFooterController");

const router = express.Router();

router.get("/", asyncHandler(siteFooterController.getPublic));

module.exports = router;
