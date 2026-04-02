const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const cmsPageController = require("../controllers/cmsPageController");

const router = express.Router();

router.get("/:slug", asyncHandler(cmsPageController.getPublic));

module.exports = router;
