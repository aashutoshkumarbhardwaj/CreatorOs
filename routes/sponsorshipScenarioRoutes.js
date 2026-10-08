const express = require("express");
const { protect } = require("../middleware/auth");
const {
  listScenarios,
  createScenario,
  updateScenario,
  deleteScenario,
  getProposal,
  exportProposalHtml,
} = require("../controller/sponsorshipScenarioController");

const router = express.Router();
router.use(protect);
router.get("/", listScenarios);
router.post("/", createScenario);
router.post("/export-html", exportProposalHtml);
router.get("/:id/proposal", getProposal);
router.put("/:id", updateScenario);
router.delete("/:id", deleteScenario);

module.exports = router;