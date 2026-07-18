const express = require("express");
const dns = require("dns").promises;
const User = require("../model/user");
const { restrictToLoggedinUserOnly } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

/**
 * @swagger
 * /api/domain/verify:
 *   post:
 *     summary: Verify custom domain
 *     description: Checks DNS records (CNAME) to verify ownership of a custom domain.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               domain:
 *                 type: string
 *     responses:
 *       200:
 *         description: Domain verified
 *       400:
 *         description: Domain verification failed
 */
router.post("/verify", restrictToLoggedinUserOnly, asyncHandler(async (req, res) => {
    const { domain } = req.body;
    
    if (!domain) {
        return res.status(400).json({ success: false, message: "Domain is required" });
    }

    try {
        // Look up CNAME records for the domain
        const records = await dns.resolveCname(domain);
        
        // Mock verification: check if it points to our generic app domain
        // Or if in mock mode, just accept it
        const isVerified = records.includes("cname.creatoros.com") || process.env.NODE_ENV !== "production";

        if (isVerified) {
            await User.findByIdAndUpdate(req.user._id, { customDomain: domain, domainVerified: true });
            return res.json({ success: true, message: "Domain verified successfully" });
        } else {
            return res.status(400).json({ success: false, message: "Domain DNS records are not pointing correctly" });
        }
    } catch (error) {
        // If dns lookup fails in dev, mock success to allow progression
        if (process.env.NODE_ENV !== "production") {
            await User.findByIdAndUpdate(req.user._id, { customDomain: domain, domainVerified: true });
            return res.json({ success: true, message: "Domain verified successfully (mock)" });
        }
        return res.status(400).json({ success: false, message: "Failed to resolve domain" });
    }
}));

module.exports = router;
