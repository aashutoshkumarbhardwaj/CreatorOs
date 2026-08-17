const express = require("express");
const router = express.Router();
const multer = require("multer");
const {
  handleGenerateShortURL,
  handleListUserLinks,
  handleGetQRCode,
  handleDownloadQRCode,
  handleUpdateQRColors,
  handleGetAnalytics,
  handleDeleteShortURL,
  handleUpdateShortURL,
  handleToggleFavorite,
  handleToggleArchive,
  handleBulkImport,
} = require("../controller/url");

// In-memory storage is fine here — bulk import files are small text/CSV,
// parsed immediately and never written to disk.
const bulkImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1 * 1024 * 1024 }, // 1MB
});
const { protect, preventContributorWrites } = require("../middleware/auth");

const { urlShortenerApiLimiter } = require("../middleware/rateLimiters");
const {
  shortenUrlValidator,
  updateQrColorsValidator,
} = require("../middleware/validators");

/**
 * @swagger
 * /:
 *   get:
 *     summary: GET request for /
 *     description: Retrieves the main resource or renders the root page.
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
router.get("/", protect, handleListUserLinks);

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
router.post(
  "/shorten",
  protect,
  preventContributorWrites,
  urlShortenerApiLimiter,
  shortenUrlValidator,
  handleGenerateShortURL,
);

// POST /api/urls — alias so the My Links front-end (which POSTs to /api/urls) also works
router.post(
  "/",
  protect,
  preventContributorWrites,
  urlShortenerApiLimiter,
  shortenUrlValidator,
  handleGenerateShortURL,
);

// DELETE /api/urls/:shortId — delete a short link
router.delete(
  "/:shortId",
  protect,
  preventContributorWrites,
  handleDeleteShortURL,
);

// PATCH /api/urls/:shortId — edit title/destination/tag/tags/expiry/password
router.patch(
  "/:shortId",
  protect,
  preventContributorWrites,
  handleUpdateShortURL,
);

// PATCH /api/urls/:shortId/favorite — toggle favorite
router.patch(
  "/:shortId/favorite",
  protect,
  preventContributorWrites,
  handleToggleFavorite,
);

// PATCH /api/urls/:shortId/archive — toggle archive
router.patch(
  "/:shortId/archive",
  protect,
  preventContributorWrites,
  handleToggleArchive,
);

// POST /api/urls/bulk — bulk import via pasted text and/or a .csv file
router.post(
  "/bulk",
  protect,
  preventContributorWrites,
  urlShortenerApiLimiter,
  bulkImportUpload.single("file"),
  handleBulkImport,
);

// ── QR Code Endpoints ───────────────────────────────────────────────────────

/**
 * @swagger
 * /qr/:shortId/download:
 *   get:
 *     summary: GET request for /qr/:shortId/download
 *     description: Downloads the QR code image for a specific shortened URL.
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
router.get("/qr/:shortId/download", protect, handleDownloadQRCode);

/**
 * @swagger
 * /qr/:shortId:
 *   get:
 *     summary: GET request for /qr/:shortId
 *     description: Retrieves the QR code image for a specific shortened URL.
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
router.get("/qr/:shortId", protect, handleGetQRCode);

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
router.patch(
  "/qr/:shortId/colors",
  protect,
  preventContributorWrites,
  updateQrColorsValidator,
  handleUpdateQRColors,
);

// ── Analytics Endpoints ─────────────────────────────────────────────────────

/**
 * @swagger
 * /analytics/:shortId:
 *   get:
 *     summary: GET request for /analytics/:shortId
 *     description: Retrieves analytics data for a specific shortened URL.
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
router.get("/analytics/:shortId", protect, handleGetAnalytics);

module.exports = router;
