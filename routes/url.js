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


/**
 * @swagger
 * /:
 *   get:
 *     summary: GET request for /
 *     description: Automatically generated swagger documentation for /
 *     responses:
 *       200:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/', protect, handleListUserLinks);

/**
 * @swagger
 * /analytics/:shortId:
 *   get:
 *     summary: GET request for /analytics/:shortId
 *     description: Automatically generated swagger documentation for /analytics/:shortId
 *     responses:
 *       200:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/analytics/:shortId', handleGetAnalytics);
// ── Short URL Endpoints ─────────────────────────────────────────────────────

/**
 * @swagger
 * /shorten:
 *   post:
 *     summary: POST request for /shorten
 *     description: Automatically generated swagger documentation for /shorten
 *     responses:
 *       200:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/shorten', protect, preventContributorWrites, urlShortenerApiLimiter, handleGenerateShortUrl);

/**
 * @swagger
 * /:
 *   post:
 *     summary: POST request for /
 *     description: Automatically generated swagger documentation for /
 *     responses:
 *       200:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/', protect, preventContributorWrites, urlShortenerApiLimiter, handleGenerateShortUrl);

// ── QR Code Endpoints ───────────────────────────────────────────────────────

/**
 * @swagger
 * /qr/:shortId/download:
 *   get:
 *     summary: GET request for /qr/:shortId/download
 *     description: Automatically generated swagger documentation for /qr/:shortId/download
 *     responses:
 *       200:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/qr/:shortId/download', handleDownloadQRCode);      

/**
 * @swagger
 * /qr/:shortId:
 *   get:
 *     summary: GET request for /qr/:shortId
 *     description: Automatically generated swagger documentation for /qr/:shortId
 *     responses:
 *       200:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/qr/:shortId',          handleGetQRCode);       

/**
 * @swagger
 * /qr/:shortId/colors:
 *   patch:
 *     summary: PATCH request for /qr/:shortId/colors
 *     description: Automatically generated swagger documentation for /qr/:shortId/colors
 *     responses:
 *       200:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.patch('/qr/:shortId/colors', protect, preventContributorWrites, handleUpdateQRColors);

// ── Analytics Endpoints ─────────────────────────────────────────────────────

/**
 * @swagger
 * /analytics/:shortId:
 *   get:
 *     summary: GET request for /analytics/:shortId
 *     description: Automatically generated swagger documentation for /analytics/:shortId
 *     responses:
 *       200:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/analytics/:shortId',   handleGetAnalytics);

module.exports = router;