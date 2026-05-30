const express = require('express');
const router = express.Router();
const {
    handleGenerateShortUrl,
    handleGetQRCode,
    handleDownloadQRCode,
    handleUpdateQRColors,
    handleGetAnalytics,
} = require('../controller/url');
const protect = require('../middleware/auth');
const { preventContributorWrites } = require('../middleware/auth');

// ── Short URL Endpoints ─────────────────────────────────────────────────────
router.post('/shorten', protect, preventContributorWrites, handleGenerateShortUrl);
router.post('/', protect, preventContributorWrites, handleGenerateShortUrl);

// ── QR Code Endpoints ───────────────────────────────────────────────────────
router.get('/qr/:shortId/download', handleDownloadQRCode);      
router.get('/qr/:shortId',          handleGetQRCode);       
router.patch('/qr/:shortId/colors', protect, preventContributorWrites, handleUpdateQRColors);

// ── Analytics Endpoints ─────────────────────────────────────────────────────
router.get('/analytics/:shortId',   handleGetAnalytics);

module.exports = router;