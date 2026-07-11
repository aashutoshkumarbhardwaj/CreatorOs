const express = require("express");
const { createCheckoutSession, handleWebhook } = require("../controller/billing");
const { restrictToLoggedinUserOnly } = require("../middleware/auth");

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
 */
router.post("/checkout", restrictToLoggedinUserOnly, createCheckoutSession);

/**
 * @swagger
 * /api/billing/webhook:
 *   post:
 *     summary: Stripe webhook receiver
 *     description: Handles incoming Stripe events like checkout.session.completed.
 *     responses:
 *       200:
 *         description: Event received
 */
router.post("/webhook", express.raw({ type: 'application/json' }), handleWebhook);

module.exports = router;
