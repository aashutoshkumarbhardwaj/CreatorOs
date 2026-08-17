const express = require("express");
const { createCheckoutSession } = require("../controller/billing");
const { protect } = require("../middleware/auth");
const { billingCheckoutLimiter } = require("../middleware/rateLimiters");

const router = express.Router();

/**
 * @swagger
 * /api/billing/checkout:
 *   post:
 *     summary: Create a Stripe checkout session
 *     description: Initializes a Stripe checkout session for the Pro tier.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Checkout session created successfully
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Too many requests
 */
router.post("/checkout", protect, billingCheckoutLimiter, createCheckoutSession);

module.exports = router;
