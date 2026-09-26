const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  createContract,
  getContracts,
  updateStageAndDeliverables,
  getPipelineForecastReport,
} = require("../controller/crmDeliverableController");

router.use(protect);

router.get("/contracts", getContracts);
router.post("/contracts", createContract);
router.put("/contracts/:id", updateStageAndDeliverables);
router.get("/forecast", getPipelineForecastReport);

module.exports = router;
