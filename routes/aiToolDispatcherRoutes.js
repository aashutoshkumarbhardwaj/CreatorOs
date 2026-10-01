const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  executeToolAction,
  getRegisteredTools,
  getAuditHistory,
} = require("../controller/aiToolDispatcherController");

router.use(protect);

router.get("/registry", getRegisteredTools);
router.post("/dispatch", executeToolAction);
router.get("/audit-history", getAuditHistory);

module.exports = router;
