const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  createRateCard,
  getRateCards,
  getPublicRateCard,
  updateRateCard,
  deleteRateCard,
  calculateQuote,
  estimateBaseline,
} = require("../controller/rateCardController");

// Public endpoints
router.get("/public/:slug", getPublicRateCard);
router.post("/calculate-quote", calculateQuote);
router.get("/baseline-estimator", estimateBaseline);

// Creator protected routes
router.use(protect);
router.get("/", getRateCards);
router.post("/", createRateCard);
router.put("/:id", updateRateCard);
router.delete("/:id", deleteRateCard);

module.exports = router;
