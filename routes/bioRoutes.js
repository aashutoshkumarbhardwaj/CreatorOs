
"use strict";

const express = require("express");
const rateLimit = require("express-rate-limit");

const router = express.Router();

// --------------------------------------------------
// MIDDLEWARE
// --------------------------------------------------

const { protect } = require("../middleware/auth");

const {
    renderBioEditor,
    saveBioProfile,
    checkHandleAvailability,
    renderPublicBioProfile,
    trackLinkClick,
} = require("../controller/bioController");

// --------------------------------------------------
// RATE LIMITERS
// --------------------------------------------------

// General API rate limiter
const bioApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many requests. Please try again later.",
    },
});

// Profile update limiter
const profileUpdateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many profile updates. Please try again later.",
    },
});

// Handle availability limiter
const handleCheckLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 40,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many handle checks. Please try again later.",
    },
});

// Public link tracking limiter
const clickTrackerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many link tracking requests.",
    },
});

// --------------------------------------------------
// PRIVATE CREATOR BIO ROUTES
// --------------------------------------------------

// Render creator bio editor
router.get(
    "/bio",
    protect,
    renderBioEditor
);

// Save or update creator bio profile
router.post(
    "/bio/save",
    protect,
    bioApiLimiter,
    profileUpdateLimiter,
    saveBioProfile
);

// Check username / handle availability
router.get(
    "/bio/check-handle/:handle",
    protect,
    handleCheckLimiter,
    checkHandleAvailability
);

// --------------------------------------------------
// PUBLIC BIO ANALYTICS ROUTES
// --------------------------------------------------

// Track clicks on public bio links
router.post(
    "/bio/track/:linkId",
    clickTrackerLimiter,
    trackLinkClick
);

// --------------------------------------------------
// PUBLIC BIO PROFILE ROUTES
// --------------------------------------------------

// Primary public profile URL
router.get(
    "/@:handle",
    renderPublicBioProfile
);

// Alternative profile URL
router.get(
    "/bio/:handle",
    renderPublicBioProfile
);

// Short public profile URL
router.get(
    "/u/:handle",
    renderPublicBioProfile
);

// Branded public profile URL
router.get(
    "/b/:handle",
    renderPublicBioProfile
);

// --------------------------------------------------
// EXPORT ROUTER
// --------------------------------------------------

module.exports = router;
