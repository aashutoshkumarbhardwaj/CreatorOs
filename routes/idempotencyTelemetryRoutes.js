const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const IdempotencyRecord = require("../model/idempotencyRecord");

router.use(protect);

/**
 * Get active idempotency records and telemetry
 */
router.get("/records", async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const { status, limit = 20 } = req.query;

    const query = { creatorId };
    if (status) query.status = status;

    const records = await IdempotencyRecord.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    const totalRecords = await IdempotencyRecord.countDocuments({ creatorId });

    return res.status(200).json({
      success: true,
      count: records.length,
      total: totalRecords,
      records: records.map((r) => ({
        key: r.idempotencyKey,
        path: r.requestPath,
        status: r.status,
        statusCode: r.responseStatusCode,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching records", error: error.message });
  }
});

/**
 * Clear expired or failed record
 */
router.delete("/record/:key", async (req, res) => {
  try {
    const { key } = req.params;
    await IdempotencyRecord.findOneAndDelete({ idempotencyKey: key });
    return res.status(200).json({ success: true, message: "Key cleared" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to clear key", error: error.message });
  }
});

module.exports = router;
