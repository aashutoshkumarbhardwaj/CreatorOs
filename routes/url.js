const express = require('express');
const router = express.Router();
const Url = require('../model/url');
const {
    handleGenerateShortUrl,
    handleGetQRCode,
    handleDownloadQRCode,
    handleUpdateQRColors,
    handleGetAnalytics,
} = require('../controller/url');
const protect = require('../middleware/auth');
const { preventContributorWrites } = require('../middleware/auth');

// ── Short URL ─────────────────────────────────────────────────────────────────
router.post('/', protect, preventContributorWrites, handleGenerateShortUrl);

// ── QR Code ───────────────────────────────────────────────────────────────────
// ── QR Code ───────────────────────────────────────────────────────────────────
router.get('/qr/:shortId/download', handleDownloadQRCode);      
router.get('/qr/:shortId',          handleGetQRCode);       
router.patch('/qr/:shortId/colors', protect, preventContributorWrites, handleUpdateQRColors);

// ── Analytics ─────────────────────────────────────────────────────────────────
router.get('/analytics/:shortId',   handleGetAnalytics);

module.exports = router;