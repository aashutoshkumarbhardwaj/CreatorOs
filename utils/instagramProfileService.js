const { execFile } = require('child_process');
const path = require('path');

const USERNAME_PATTERN = /^[A-Za-z0-9._]{1,30}$/;
const DEFAULT_TIMEOUT_MS = 8000;

class InstagramProfileError extends Error {
    constructor(code, message, statusCode = 500, details = null) {
        super(message);
        this.name = 'InstagramProfileError';
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
    }
}

/**
 * @function normalizeUsername
 * @description Automatically generated JSDoc for normalizeUsername
 * @returns {any}
 */
function normalizeUsername(username) {
    return String(username || '')
        .trim()
        .replace(/^@/, '')
        .toLowerCase();
}

/**
 * @function validateUsername
 * @description Automatically generated JSDoc for validateUsername
 * @returns {any}
 */
function validateUsername(username) {
    const normalizedUsername = normalizeUsername(username);

    if (!normalizedUsername || !USERNAME_PATTERN.test(normalizedUsername)) {
        throw new InstagramProfileError(
            'INVALID_USERNAME',
            'Enter a valid Instagram username using letters, numbers, periods, or underscores.',
            400
        );
    }

    if (normalizedUsername.includes('..')) {
        throw new InstagramProfileError(
            'INVALID_USERNAME',
            'Instagram usernames cannot contain consecutive periods.',
            400
        );
    }

    return normalizedUsername;
}

/**
 * @function runPythonProvider
 * @description Automatically generated JSDoc for runPythonProvider
 * @returns {any}
 */
function runPythonProvider(username) {
    const pythonPath = process.env.INSTAGRAM_PYTHON_PATH || 'python';
    const scriptPath = path.join(__dirname, 'instagram_public_profile.py');

    return new Promise((resolve, reject) => {
        execFile(
            pythonPath,
            [scriptPath, username],
            { timeout: DEFAULT_TIMEOUT_MS, maxBuffer: 1024 * 1024 },
            (error, stdout, stderr) => {
                if (error) {
                    if (error.killed || error.signal === 'SIGTERM') {
                        return reject(new InstagramProfileError(
                            'TEMPORARY_FETCH_ERROR',
                            'Instagram profile request timed out. Please try again.',
                            504
                        ));
                    }

                    const message = stderr?.trim() || 'Unable to fetch Instagram profile via Python provider.';
                    return reject(new InstagramProfileError('TEMPORARY_FETCH_ERROR', message, 500));
                }

                let payload = null;
                try {
                    payload = JSON.parse(stdout);
                } catch (parseError) {
                    return reject(new InstagramProfileError(
                        'TEMPORARY_FETCH_ERROR',
                        'Python provider returned invalid JSON.',
                        500
                    ));
                }

                if (!payload || typeof payload !== 'object') {
                    return reject(new InstagramProfileError(
                        'TEMPORARY_FETCH_ERROR',
                        'Python provider returned an empty response.',
                        500
                    ));
                }

                if (payload.success === false) {
                    const errorPayload = payload.error || {};
                    return reject(new InstagramProfileError(
                        errorPayload.code || 'TEMPORARY_FETCH_ERROR',
                        errorPayload.message || 'Python provider failed to fetch the profile.',
                        errorPayload.statusCode || 500
                    ));
                }

                return resolve(payload.data);
            }
        );
    });
}

/**
 * @function parseMetricValue
 * @description Automatically generated JSDoc for parseMetricValue
 * @returns {any}
 */
function parseMetricValue(raw) {
    if (!raw) {
        return 0;
    }

    const normalized = String(raw).trim().toLowerCase().replace(/,/g, '');
    const match = normalized.match(/(\d+(?:\.\d+)?)([km])?/);

    if (!match) {
        return Number.parseInt(normalized, 10) || 0;
    }

    const base = Number.parseFloat(match[1]);
    const suffix = match[2];

    if (suffix === 'k') {
        return Math.round(base * 1000);
    }

    if (suffix === 'm') {
        return Math.round(base * 1000000);
    }

    return Math.round(base);
}

/**
 * @function extractMetaContent
 * @description Automatically generated JSDoc for extractMetaContent
 * @returns {any}
 */
function extractMetaContent(html, property) {
    const pattern = new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i');
    const match = html.match(pattern);
    return match ? decodeHtmlEntities(match[1]) : '';
}

/**
 * @function decodeHtmlEntities
 * @description Automatically generated JSDoc for decodeHtmlEntities
 * @returns {any}
 */
function decodeHtmlEntities(value) {
    if (!value) {
        return '';
    }

    return String(value)
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&amp;/gi, '&')
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

/**
 * @function extractNameAndHandle
 * @description Automatically generated JSDoc for extractNameAndHandle
 * @returns {any}
 */
function extractNameAndHandle(ogTitle, username) {
    if (!ogTitle) {
        return { name: username, handle: username };
    }

    const match = ogTitle.match(/^(.*?)\s*\(@([^\)]+)\)/);
    if (!match) {
        return { name: ogTitle, handle: username };
    }

    return {
        name: match[1].trim() || username,
        handle: match[2].trim() || username,
    };
}

/**
 * @function extractCounts
 * @description Automatically generated JSDoc for extractCounts
 * @returns {any}
 */
function extractCounts(ogDescription) {
    if (!ogDescription) {
        return { followers: 0, following: 0, totalPosts: 0, hasCountTokens: false };
    }

    const followersMatch = ogDescription.match(/([\d.,]+\s*[km]?)\s*Followers/i);
    const followingMatch = ogDescription.match(/([\d.,]+\s*[km]?)\s*Following/i);
    const postsMatch = ogDescription.match(/([\d.,]+\s*[km]?)\s*Posts/i);
    const hasCountTokens = /Followers/i.test(ogDescription) && /Posts/i.test(ogDescription);

    return {
        followers: parseMetricValue(followersMatch?.[1]),
        following: parseMetricValue(followingMatch?.[1]),
        totalPosts: parseMetricValue(postsMatch?.[1]),
        hasCountTokens,
    };
}

/**
 * @function isPrivateProfile
 * @description Automatically generated JSDoc for isPrivateProfile
 * @returns {any}
 */
function isPrivateProfile(html, ogDescription = '', ogTitle = '') {
    return /this account is private/i.test(html)
        || /private account/i.test(html)
        || /"is_private"\s*:\s*true/i.test(html)
        || /this account is private/i.test(ogDescription)
        || /follow this account to see their photos and videos/i.test(ogDescription)
        || /private/i.test(ogTitle);
}

/**
 * @function buildNormalizedProfile
 * @description Automatically generated JSDoc for buildNormalizedProfile
 * @returns {any}
 */
function buildNormalizedProfile({ username, name, profileImage, bio, followers, following, totalPosts, source }) {
    return {
        username,
        name,
        profileImage,
        bio,
        followers: Number(followers || 0),
        following: Number(following || 0),
        totalPosts: Number(totalPosts || 0),
        category: 'Instagram public profile',
        source,
        fetchedAt: new Date().toISOString(),
    };
}

/**
 * @function fetchPublicHtmlProfile
 * @description Automatically generated JSDoc for fetchPublicHtmlProfile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>|void}
 */
async function fetchPublicHtmlProfile(username) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
        const url = `https://www.instagram.com/${encodeURIComponent(username)}/`;
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; CreatorOS/1.0; +https://creatoros.local)',
                'Accept-Language': 'en-US,en;q=0.9',
            },
        });

        if (response.status === 404) {
            throw new InstagramProfileError(
                'PROFILE_NOT_FOUND',
                'Instagram profile not found.',
                404
            );
        }

        if (response.status === 429) {
            throw new InstagramProfileError(
                'RATE_LIMITED',
                'Instagram is rate limiting public profile requests. Please try again later.',
                429
            );
        }

        if (!response.ok) {
            throw new InstagramProfileError(
                'TEMPORARY_FETCH_ERROR',
                'Instagram profile could not be fetched right now. Please try again later.',
                response.status
            );
        }

        const html = await response.text();

        if (isPrivateProfile(html)) {
            throw new InstagramProfileError(
                'PRIVATE_PROFILE_UNSUPPORTED',
                'This Instagram profile is private and cannot be fetched without authorized access.',
                403
            );
        }

        const ogTitle = extractMetaContent(html, 'og:title');
        const ogDescription = extractMetaContent(html, 'og:description');
        const ogImage = extractMetaContent(html, 'og:image');

        if (isPrivateProfile(html, ogDescription, ogTitle)) {
            throw new InstagramProfileError(
                'PRIVATE_PROFILE_UNSUPPORTED',
                'This Instagram profile is private and cannot be fetched without authorized access.',
                403
            );
        }
        const { name, handle } = extractNameAndHandle(ogTitle, username);
        const counts = extractCounts(ogDescription);

        if (!counts.hasCountTokens) {
            throw new InstagramProfileError(
                'PRIVATE_PROFILE_UNSUPPORTED',
                'This Instagram profile is private and cannot be fetched without authorized access.',
                403
            );
        }

        return buildNormalizedProfile({
            username: handle || username,
            name,
            profileImage: ogImage,
            bio: ogDescription || '',
            followers: counts.followers,
            following: counts.following,
            totalPosts: counts.totalPosts,
            source: 'instagram_public_html',
        });
    } catch (error) {
        if (error instanceof InstagramProfileError) {
            throw error;
        }

        if (error.name === 'AbortError') {
            throw new InstagramProfileError(
                'TEMPORARY_FETCH_ERROR',
                'Instagram profile request timed out. Please try again.',
                504
            );
        }

        throw new InstagramProfileError(
            'TEMPORARY_FETCH_ERROR',
            'Unable to fetch Instagram profile right now. Please try again later.',
            500
        );
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * @function fetchPythonPublicProfile
 * @description Automatically generated JSDoc for fetchPythonPublicProfile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>|void}
 */
async function fetchPythonPublicProfile(username) {
    const data = await runPythonProvider(username);

    if (!data || !data.username) {
        throw new InstagramProfileError(
            'TEMPORARY_FETCH_ERROR',
            'Python provider returned an invalid profile payload.',
            500
        );
    }

    return buildNormalizedProfile({
        username: data.username,
        name: data.name || data.username,
        profileImage: data.profileImage || '',
        bio: data.bio || '',
        followers: data.followers || 0,
        following: data.following || 0,
        totalPosts: data.totalPosts || 0,
        source: 'instagram_python_public',
    });
}

/**
 * @function resolveProvider
 * @description Automatically generated JSDoc for resolveProvider
 * @returns {any}
 */
function resolveProvider() {
    const provider = (process.env.INSTAGRAM_PUBLIC_PROVIDER || 'public_html').toLowerCase();

    if (provider === 'public_html') {
        return fetchPublicHtmlProfile;
    }

    if (provider === 'python_public') {
        return fetchPythonPublicProfile;
    }

    throw new InstagramProfileError(
        'PUBLIC_PROVIDER_UNAVAILABLE',
        'No public Instagram provider is configured. Please set INSTAGRAM_PUBLIC_PROVIDER to a supported provider.',
        500
    );
}

/**
 * @function fetchInstagramProfile
 * @description Automatically generated JSDoc for fetchInstagramProfile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>|void}
 */
async function fetchInstagramProfile(username) {
    const normalizedUsername = validateUsername(username);
    const provider = resolveProvider();
    return provider(normalizedUsername);
}

module.exports = {
    InstagramProfileError,
    fetchInstagramProfile,
    validateUsername,
};
