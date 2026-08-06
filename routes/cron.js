const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { publishDueContent } = require('../workers/contentPublishWorker');

function timingSafeEqualString(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) {
        // Keep roughly constant-time behavior without throwing on length mismatch
        crypto.timingSafeEqual(bufA, bufA);
        return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
}

async function handleCronPublish(req, res) {
    if (process.env.CRON_SECRET) {
        const authHeader = req.headers.authorization || '';
        const expected = 'Bearer ' + process.env.CRON_SECRET;
        if (!timingSafeEqualString(authHeader, expected)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }

    try {
        const publishedCount = await publishDueContent();
        return res.json({
            success: true,
            publishedCount,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('[CronPublish] Error:', err);
        return res.status(500).json({ error: 'Failed to publish due content' });
    }
}

router.get('/publish-content', handleCronPublish);
router.post('/publish-content', handleCronPublish);

module.exports = router;
