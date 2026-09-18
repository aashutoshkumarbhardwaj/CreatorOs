const express = require("express");
const { calculateSponsorshipRate } = require("../controller/sponsorshipCalculator");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.use(protect);

/**
 * @swagger
 * /api/sponsorship/calculate:
 *   post:
 *     summary: Calculate sponsorship rate
 *     description: Calculate estimated sponsorship rate based on creator metrics and campaign details
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - followers
 *               - avgViews
 *               - engagementRate
 *               - niche
 *               - contentType
 *               - deliverables
 *               - campaignDuration
 *               - usageRights
 *               - exclusivity
 *             properties:
 *               followers:
 *                 type: number
 *                 description: Number of followers
 *               avgViews:
 *                 type: number
 *                 description: Average views per post/reel
 *               engagementRate:
 *                 type: number
 *                 description: Engagement rate percentage
 *               niche:
 *                 type: string
 *                 description: Creator niche
 *               contentType:
 *                 type: string
 *                 description: Type of content
 *               deliverables:
 *                 type: number
 *                 description: Number of deliverables
 *               campaignDuration:
 *                 type: number
 *                 description: Campaign duration in days
 *               usageRights:
 *                 type: string
 *                 description: Usage rights type
 *               exclusivity:
 *                 type: string
 *                 description: Exclusivity requirements
 *     responses:
 *       200:
 *         description: Calculated sponsorship rate
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Server error
 */
router.post("/calculate", calculateSponsorshipRate);

module.exports = router;