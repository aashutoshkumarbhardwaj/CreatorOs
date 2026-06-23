const rateLimit = require('express-rate-limit');
const { wantsHtml } = require('../utils/requestType');
const { buildShortenerViewModel } = require('../utils/viewModels');

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    handler: (req, res) => {
        const message = 'Too many login attempts, please try again later.';
        if (wantsHtml(req)) {
            return res.status(429).render('login', {
                error: message,
                googleAuthConfigured: Boolean(process.env.GOOGLE_CLIENT_ID)
            });
        }
        return res.status(429).json({ success: false, message, error: message });
    }
});

const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    handler: (req, res) => {
        const message = 'Upload limit reached, please try again later.';
        return res.status(429).json({ success: false, message, error: message });
    }
});

const urlShortenerPageLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 30,
    handler: (req, res) => {
        const message = 'Too many URLs generated, please try again later.';
        return res.status(429).render('home', buildShortenerViewModel(req, null, message));
    }
});

const urlShortenerApiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 30,
    handler: (req, res) => {
        const message = 'Too many URLs generated, please try again later.';
        return res.status(429).json({ success: false, message, error: message });
    }
});

const signupLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    handler: (req, res) => {
        const message = 'Too many accounts created from this IP, please try again later.';
        if (wantsHtml(req)) {
            return res.status(429).render('signup', { error: message });
        }
        return res.status(429).json({ success: false, message, error: message });
    }
});

const emailVerificationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    handler: (req, res) => {
        const message = 'Too many requests. Please wait before trying again.';
        if (wantsHtml(req)) {
            return res.status(429).render('resend-verification', { error: message, success: null });
        }
        return res.status(429).json({ success: false, message, error: message });
    }
});

const MongoStore = require('rate-limit-mongo');

const aiGenerationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per 15 minutes
    keyGenerator: (req) => req.user?.id || req.ip || 'anonymous',
    store: process.env.MONGODB_URI ? new MongoStore({
        uri: process.env.MONGODB_URI,
        expireTimeMs: 15 * 60 * 1000,
    }) : undefined,
    handler: (req, res) => {
        const message = 'Too many AI generation requests. Please wait 15 minutes before trying again.';
        if (wantsHtml(req)) {
            return res.status(429).send(message);
        }
        return res.status(429).json({ success: false, message, error: message });
    }
});
const instagramProfileLimiter = rateLimit({
    windowMs: (process.env.INSTAGRAM_LOOKUP_COOLDOWN_SECONDS || 30) * 1000,
    max: 1,
    keyGenerator: (req) => req.user?.id || req.ip || 'anonymous',
    store: process.env.MONGODB_URI ? new MongoStore({
        uri: process.env.MONGODB_URI,
        expireTimeMs: (process.env.INSTAGRAM_LOOKUP_COOLDOWN_SECONDS || 30) * 1000,
    }) : undefined,
    handler: (req, res) => {
        return res.status(429).json({
            success: false,
            error: {
                code: 'RATE_LIMITED',
                message: `Please wait ${process.env.INSTAGRAM_LOOKUP_COOLDOWN_SECONDS || 30} seconds before fetching another Instagram profile.`,
            }
        });
    }
});

module.exports = {
    loginLimiter,
    uploadLimiter,
    urlShortenerPageLimiter,
    urlShortenerApiLimiter,
    signupLimiter,
    emailVerificationLimiter,
    aiGenerationLimiter,
    instagramProfileLimiter
};
