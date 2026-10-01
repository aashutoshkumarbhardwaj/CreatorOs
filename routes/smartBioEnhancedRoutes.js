const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  updateBioProfileTheme,
  getPublicBioProfile,
  submitBioLead,
  recordWidgetClick,
  getBioAnalytics,
} = require("../controller/smartBioEnhancedController");

// Public Bio Endpoints
router.get("/p/:username", getPublicBioProfile);
router.post("/p/:username/lead", submitBioLead);
router.post("/p/:username/click/:widgetId", recordWidgetClick);

// Creator Protected Endpoints
router.use(protect);
router.put("/profile", updateBioProfileTheme);
router.get("/analytics", getBioAnalytics);

module.exports = router;
