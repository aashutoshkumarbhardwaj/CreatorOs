const express = require('express');
const router = express.Router();
const { publishDueContent } = require('../workers/contentPublishWorker');

async function handleCronPublish(req, res) {
    if (process.env.CRON_SECRET) {
        const authHeader = req.headers.authorization;
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
