const express = require('express');
const router = express.Router();
const {
    qrWriteLimiter,
    renderQrGeneratorPage,
    createQrCode,
    batchCreateQrCodes,
    exportQrCode,
    updateQrCode,
    deleteQrCode,
    getQrAnalytics,
    getQrTelemetry,
} = require('../controller/qrCodeController');
const {
    protect,
    preventContributorWrites,
} = require('../middleware/auth');

router.get('/', protect, renderQrGeneratorPage);
router.post('/create', protect, preventContributorWrites, qrWriteLimiter, createQrCode);
router.post('/batch', protect, preventContributorWrites, qrWriteLimiter, batchCreateQrCodes);
router.get('/:id/export', protect, exportQrCode);
router.patch('/:id', protect, preventContributorWrites, updateQrCode);
router.delete('/:id', protect, preventContributorWrites, deleteQrCode);
router.get('/:id/analytics', protect, getQrAnalytics);
router.get('/telemetry', protect, getQrTelemetry);

module.exports = router;
