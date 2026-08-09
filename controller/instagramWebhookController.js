const { dmQueue } = require('../services/dmQueueService');
const asyncHandler = require('../utils/asyncHandler');

const crypto = require('crypto');

// In-memory deduplication set for processed webhook event IDs
// TTL: 5 minutes to prevent unbounded memory growth
const processedEvents = new Map();
const EVENT_TTL_MS = 5 * 60 * 1000;

// Periodic cleanup of expired event IDs
const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [eventId, timestamp] of processedEvents) {
        if (now - timestamp > EVENT_TTL_MS) {
            processedEvents.delete(eventId);
        }
    }
}, 60 * 1000);
cleanupInterval.unref();

function isEventAlreadyProcessed(eventId) {
    if (!eventId) return false;
    if (processedEvents.has(eventId)) return true;
    processedEvents.set(eventId, Date.now());
    return false;
}

// Verify the webhook from Meta
const verifyWebhook = (req, res) => {
    const VERIFY_TOKEN = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;

    if (!VERIFY_TOKEN) {
        console.error('[Webhook] INSTAGRAM_WEBHOOK_VERIFY_TOKEN is not configured');
        return res.sendStatus(500);
    }

    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            return res.status(200).send(challenge);
        } else {
            return res.sendStatus(403);
        }
    }
    
    return res.status(400).send('Missing hub variables');
};

const verifyWebhookSignature = (req, res, next) => {
    const signature = req.headers['x-hub-signature-256'];
    
    if (!signature) {
        console.warn('[Webhook] Missing X-Hub-Signature-256 header');
        return res.sendStatus(403);
    }
    
    const APP_SECRET = process.env.INSTAGRAM_APP_SECRET;
    
    if (!APP_SECRET) {
        console.error('[Webhook] INSTAGRAM_APP_SECRET is not configured');
        return res.sendStatus(500);
    }
    
    const payload = req.rawBody;
    
    if (!payload) {
        console.error('[Webhook] Raw body is missing. Ensure express.json({verify: ...}) is configured.');
        return res.sendStatus(500);
    }

    const expectedSignature = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(payload).digest('hex');

    try {
        if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
            return next();
        }
    } catch (e) {
        // catch error if buffer lengths don't match
    }

    console.warn('[Webhook] Invalid signature');
    return res.sendStatus(403);
};

// Handle incoming webhook events
const handleWebhook = asyncHandler(async (req, res, next) => {
    const body = req.body || {};

    // Check for duplicate event using X-Event-ID header or payload-level deduplication
    const headerEventId = req.headers['x-event-id'];
    
    // Check if it's a page or instagram event
    if (body.object === 'instagram') {
        if (body.entry && body.entry.length > 0) {
            for (const entry of body.entry) {
                if (entry.messaging && entry.messaging.length > 0) {
                    for (const webhookEvent of entry.messaging) {
                        const senderId = webhookEvent?.sender?.id;
                        const message = webhookEvent?.message;
                        const timestamp = webhookEvent?.timestamp;

                        if (senderId && message && message.text) {
                            // Build a unique event ID from sender + message + timestamp for deduplication
                            const eventId = headerEventId || crypto
                                .createHash('sha256')
                                .update(`${senderId}:${message.mid || message.text}:${timestamp || Date.now()}`)
                                .digest('hex');

                            if (isEventAlreadyProcessed(eventId)) {
                                console.log(`[Webhook] Duplicate event ${eventId}, skipping`);
                                continue;
                            }

                            console.log(`[Webhook] Received message from ${senderId}: ${message.text}`);
                            
                            // Enqueue the message for asynchronous processing instead of synchronous execution
                            // We set exponential backoff: 5 retries, starting with 2 seconds delay
                            try {
                                await dmQueue.add('process-dm', {
                                    senderId: senderId,
                                    message: message.text,
                                    triggerKeyword: message.text.toLowerCase(),
                                    eventId: eventId,
                                }, {
                                    attempts: 5,
                                    backoff: {
                                        type: 'exponential',
                                        delay: 2000
                                    },
                                    jobId: eventId,
                                });
                            } catch (error) {
                                console.warn(`[Webhook] DM queue unavailable, skipping async processing: ${error.message}`);
                            }
                        }
                    }
                }
            }
        }
        
        // Return a '200 OK' response to all requests immediately
        // so Instagram doesn't think the webhook failed and resends it.
        return res.status(200).send('EVENT_RECEIVED');
    } else {
        // Return a '404 Not Found' if event is not from a supported object
        return res.sendStatus(404);
    }
});

module.exports = {
    verifyWebhook,
    verifyWebhookSignature,
    handleWebhook
};
