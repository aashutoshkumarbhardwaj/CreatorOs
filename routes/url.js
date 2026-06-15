const express = require('express');
const router = express.Router();
const {
    handleGenerateShortUrl,
    handleListUserLinks,
    handleGetQRCode,
    handleDownloadQRCode,
    handleUpdateQRColors,
    handleGetAnalytics,
} = require('../controller/url');
const protect = require('../middleware/auth');
const { preventContributorWrites } = require('../middleware/auth');
const { urlShortenerApiLimiter } = require('../middleware/rateLimiters');
const { validate, urlShortenSchema, urlQRColorsSchema } = require('../middleware/validators');

router.get('/', protect, handleListUserLinks);
router.get('/analytics/:shortId', handleGetAnalytics);
// ── Short URL Endpoints ─────────────────────────────────────────────────────
router.post('/shorten', protect, preventContributorWrites, urlShortenerApiLimiter, validate(urlShortenSchema, 'body'), handleGenerateShortUrl);
router.post('/', protect, preventContributorWrites, urlShortenerApiLimiter, validate(urlShortenSchema, 'body'), handleGenerateShortUrl);

// ── QR Code Endpoints ───────────────────────────────────────────────────────
router.get('/qr/:shortId/download', handleDownloadQRCode);      
router.get('/qr/:shortId',          handleGetQRCode);       
router.patch('/qr/:shortId/colors', protect, preventContributorWrites, validate(urlQRColorsSchema, 'body'), handleUpdateQRColors);

// ── Analytics Endpoints ─────────────────────────────────────────────────────
router.get('/analytics/:shortId',   handleGetAnalytics);

module.exports = router;