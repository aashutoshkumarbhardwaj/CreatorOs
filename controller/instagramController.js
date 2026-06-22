const { fetchInstagramProfile, InstagramProfileError, validateUsername } = require('../utils/instagramProfileService');


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
