const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  recordCohortSnapshot,
  getCohorts,
  auditAnomalies,
} = require("../controller/analyticsCohortController");

router.use(protect);

router.get("/", getCohorts);
router.post("/snapshot", recordCohortSnapshot);
router.post("/audit-anomaly", auditAnomalies);

module.exports = router;
