const { fetchInstagramProfile, InstagramProfileError, validateUsername } = require('../utils/instagramProfileService');
const { getInstagramLookupCooldownSeconds } = require('../utils/instagramCooldown');
const { createRedisClient } = require('../utils/redisClient');

const redis = createRedisClient();
const memoryStore = new Map();

if (redis?.on) {
    redis.on('error', (error) => {
        console.warn(`[InstagramProfile] Redis error: ${error.message}`);
    });
}

/**
 * @function getCooldownSeconds
 * @description Automatically generated JSDoc for getCooldownSeconds
 * @returns {any}
 */
function getCooldownSeconds() {
    return getInstagramLookupCooldownSeconds({ allowZero: true });
}

/**
 * @function getLookupKey
 * @description Automatically generated JSDoc for getLookupKey
 * @returns {any}
 */
function getLookupKey(req) {
    return req.user?.id || req.ip || 'anonymous';
}

function getMemoryValue(key) {
    const entry = memoryStore.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
        memoryStore.delete(key);
        return null;
    }
    return entry.value;
}

function setMemoryValue(key, value, ttlSeconds) {
    memoryStore.set(key, {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000,
    });
}

/**
 * @function assertLookupAllowed
 * @description Enforces a distributed per-user cooldown using Redis (SET NX EX),
 * replacing the previous in-memory Map so cooldowns are shared across all
 * Node.js instances and serverless workers.
 * @returns {Promise<void>}
 */
async function assertLookupAllowed(req) {
    const cooldownSeconds = getCooldownSeconds();

    if (cooldownSeconds === 0) {
        return;
    }

    const lookupKey = `ig:cooldown:${getLookupKey(req)}`;
    if (!redis) {
        const expiresAt = getMemoryValue(lookupKey);
        if (expiresAt) {
            const retryAfter = Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000));
            throw new InstagramProfileError(
                'RATE_LIMITED',
                `Please wait ${retryAfter} seconds before fetching another Instagram profile.`,
                429,
                { retryAfter }
            );
        }

        setMemoryValue(lookupKey, Date.now() + cooldownSeconds * 1000, cooldownSeconds);
        return;
    }

    const result = await redis.set(lookupKey, '1', 'EX', cooldownSeconds, 'NX');

    if (!result) {
        const ttl = await redis.ttl(lookupKey);
        const retryAfter = ttl > 0 ? ttl : cooldownSeconds;
        throw new InstagramProfileError(
            'RATE_LIMITED',
            `Please wait ${retryAfter} seconds before fetching another Instagram profile.`,
            429,
            { retryAfter }
        );
    }
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
 * Checks Redis cache first (30-min TTL) to avoid redundant network requests,
 * then enforces a distributed per-user cooldown before hitting Instagram.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>|void}
 */
async function getInstagramProfile(req, res) {
    try {
        const username = validateUsername(req.query.username);
        const cacheKey = `ig:profile:${username}`;
        const cachedProfile = redis
            ? await redis.get(cacheKey)
            : getMemoryValue(cacheKey);

        if (cachedProfile) {
            return res.json({
                success: true,
                data: JSON.parse(cachedProfile),
            });
        }

        await assertLookupAllowed(req);

        const profile = await fetchInstagramProfile(username);

        if (redis) {
            await redis.set(cacheKey, JSON.stringify(profile), 'EX', 1800); // 30 minutes TTL
        } else {
            setMemoryValue(cacheKey, JSON.stringify(profile), 1800);
        }

        return res.json({
            success: true,
            data: profile,
        });
    } catch (error) {
        return sendInstagramError(res, error);
    }
}

/**
 * @function verifyInstagramWebhook
 * @description Handles the Meta webhook verification handshake (GET).
 * Meta sends hub.mode, hub.verify_token, and hub.challenge; we must echo
 * hub.challenge back if the verify_token matches.
 */
function verifyInstagramWebhook(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN) {
        console.log('[Webhook] Instagram webhook verified.');
        return res.status(200).send(challenge);
    }

    return res.status(403).json({ success: false, message: 'Webhook verification failed.' });
}

/**
 * @function handleInstagramWebhook
 * @description Processes incoming Instagram webhook events (POST).
 *
 * Handles two webhook fields:
 *  - `comments`  → triggers comment-to-DM automation (OpenReply-style)
 *  - `messages`  → triggers inbound DM automation (existing dmQueueService flow)
 *
 * Meta requires a 200 response within 20 s or it will retry.
 */
async function handleInstagramWebhook(req, res) {
    // Respond immediately to Meta — processing happens asynchronously
    res.status(200).send('EVENT_RECEIVED');

    try {
        const body = req.body;
        if (body?.object !== 'instagram') {
            return;
        }

        const Creator = require('../model/creator');
        const { dmQueue } = require('../services/dmQueueService');
        const { handleCommentTrigger } = require('../services/commentDmService');

        for (const entry of body?.entry || []) {
            const creatorIgId = entry.id;

            // Resolve creator from their Instagram page ID
            const creator = await Creator.findOne({ platform: 'instagram', platformId: creatorIgId });
            if (!creator) {
                console.warn(`[Webhook] No creator found for Instagram page ID ${creatorIgId}`);
                continue;
            }

            for (const change of entry?.changes || []) {
                const field = change.field;
                const value = change.value || {};

                if (field === 'comments') {
                    // Comment-to-DM: dispatch comment trigger handling
                    const commentId = value.id;
                    const commentText = value.text || '';
                    const commenterId = value.from?.id;
                    const commenterUsername = value.from?.username || '';
                    const postId = value.media?.id;

                    if (!commentId || !commenterId || !postId) {
                        console.warn('[Webhook] Incomplete comment event, skipping.', value);
                        continue;
                    }

                    handleCommentTrigger({
                        commentId,
                        commentText,
                        commenterId,
                        commenterUsername,
                        postId,
                        creatorIgId,
                        creator,
                    }).then((result) => {
                        if (!result.skipped) {
                            console.log(`[Webhook] Comment DM sent: ${JSON.stringify(result)}`);
                        }
                    }).catch((err) => {
                        console.error(`[Webhook] Comment DM error for comment ${commentId}:`, err.message);
                    });

                } else if (field === 'messages') {
                    // Inbound DM: existing queue-based automation
                    const messaging = value.messaging?.[0];
                    if (!messaging) continue;

                    const senderId = messaging.sender?.id;
                    const recipientId = messaging.recipient?.id;
                    const messageText = messaging.message?.text;

                    if (!senderId || !recipientId) continue;

                    const eventId = messaging.message?.mid || messaging.timestamp?.toString();

                    await dmQueue.add('process-dm', {
                        senderId,
                        recipientId,
                        message: messageText,
                        eventId,
                    }, {
                        attempts: 3,
                        backoff: { type: 'exponential', delay: 2000 },
                        removeOnComplete: true,
                        removeOnFail: false,
                    });
                }
            }
        }
    } catch (err) {
        console.error('[Webhook] Unhandled webhook processing error:', err.message);
    }
}

module.exports = {
    getInstagramProfile,
    verifyInstagramWebhook,
    handleInstagramWebhook,
};
