const { fetchInstagramProfile, InstagramProfileError, validateUsername } = require('../utils/instagramProfileService');

const lookupTracker = new Map();

/**
 * @function getCooldownSeconds
 * @description Automatically generated JSDoc for getCooldownSeconds
 * @returns {any}
 */
function getCooldownSeconds() {
    const value = Number(process.env.INSTAGRAM_LOOKUP_COOLDOWN_SECONDS || 30);
    return Number.isFinite(value) && value >= 0 ? value : 30;
}

/**
 * @function getLookupKey
 * @description Automatically generated JSDoc for getLookupKey
 * @returns {any}
 */
function getLookupKey(req) {
    return req.user?.id || req.ip || 'anonymous';
}

/**
 * @function assertLookupAllowed
 * @description Automatically generated JSDoc for assertLookupAllowed
 * @returns {any}
 */
function assertLookupAllowed(req) {
    const cooldownSeconds = getCooldownSeconds();

    if (cooldownSeconds === 0) {
        return;
    }

    const lookupKey = getLookupKey(req);
    const now = Date.now();
    const nextAllowedAt = lookupTracker.get(lookupKey) || 0;

    if (now < nextAllowedAt) {
        const retryAfter = Math.ceil((nextAllowedAt - now) / 1000);
        throw new InstagramProfileError(
            'RATE_LIMITED',
            `Please wait ${retryAfter} seconds before fetching another Instagram profile.`,
            429,
            { retryAfter }
        );
    }

    lookupTracker.set(lookupKey, now + cooldownSeconds * 1000);
}

/**
 * @function sendInstagramError
 * @description Automatically generated JSDoc for sendInstagramError
 * @returns {any}
 */
function sendInstagramError(res, error) {
    if (error instanceof InstagramProfileError) {
        return res.status(error.statusCode).json({
            success: false,
            error: {
                code: error.code,
                message: error.message,
                details: error.details,
            },
        });
    }

    return res.status(500).json({
        success: false,
        error: {
            code: 'TEMPORARY_FETCH_ERROR',
            message: 'Unable to fetch Instagram profile right now. Please try again later.',
        },
    });
}

/**
 * @function getInstagramProfile
 * @description Automatically generated JSDoc for getInstagramProfile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>|void}
 */
async function getInstagramProfile(req, res) {
    try {
        const username = validateUsername(req.query.username);

        assertLookupAllowed(req);

        const profile = await fetchInstagramProfile(username);

        return res.json({
            success: true,
            data: profile,
        });
    } catch (error) {
        return sendInstagramError(res, error);
    }
}

module.exports = {
    getInstagramProfile,
};
