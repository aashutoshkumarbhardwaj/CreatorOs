const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/auth');
const {
    renderBioEditor,
    saveBioProfile,
    checkHandleAvailability,
    renderPublicBioProfile,
    trackLinkClick
} = require('../controller/bioController');

// Rate limiter for link click tracking
const clickTrackerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, message: 'Too many requests' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Protected Creator Editor & Management Routes
router.get('/bio', protect, renderBioEditor);
router.post('/bio/save', protect, saveBioProfile);
router.get('/bio/check-handle/:handle', protect, checkHandleAvailability);

// Click tracking
router.post('/bio/track/:linkId', clickTrackerLimiter, trackLinkClick);

// Dynamic Public Bio Profile Routes
router.get('/@:handle', renderPublicBioProfile);
router.get('/bio/:handle', renderPublicBioProfile);
router.get('/u/:handle', renderPublicBioProfile);
router.get('/b/:handle', renderPublicBioProfile);

module.exports = router;
