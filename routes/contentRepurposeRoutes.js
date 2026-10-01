const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  createPipelineItem,
  getPipelineItems,
  transitionStage,
  toggleChecklistItem,
  generateDerivativesForPillar,
} = require("../controller/contentRepurposeController");

router.use(protect);

router.get("/items", getPipelineItems);
router.post("/items", createPipelineItem);
router.patch("/items/:id/stage", transitionStage);
router.patch("/items/:id/checklist", toggleChecklistItem);
router.post("/items/:id/generate-derivatives", generateDerivativesForPillar);

module.exports = router;
