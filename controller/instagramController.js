const { fetchInstagramProfile, InstagramProfileError, validateUsername } = require('../utils/instagramProfileService');

const lookupTracker = new Map();

/**
 * @function getCooldownSeconds
 * @description Calculates the remaining cooldown time for a specific rate-limited action.
 * @returns {any}
 */
function getCooldownSeconds() {
    const value = Number(process.env.INSTAGRAM_LOOKUP_COOLDOWN_SECONDS || 30);
    return Number.isFinite(value) && value >= 0 ? value : 30;
}

/**
 * @function getLookupKey
 * @description Generates a unique lookup key for caching or rate-limiting requests.
 * @returns {any}
 */
function getLookupKey(req) {
    return req.user?.id || req.ip || 'anonymous';
}

/**
 * @function assertLookupAllowed
 * @description Checks rate limits and throws an error if the lookup is not currently allowed.
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
 * @description Formats and sends a standardized error response for Instagram API failures.
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
 * @description Retrieves public profile information from Instagram.
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
