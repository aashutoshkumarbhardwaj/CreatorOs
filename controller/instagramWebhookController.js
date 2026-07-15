const { dmQueue } = require('../services/dmQueueService');
const asyncHandler = require('../utils/asyncHandler');

const crypto = require('crypto');

// Verify the webhook from Meta
const verifyWebhook = (req, res) => {
    // You should store your Verify Token in an environment variable
    const VERIFY_TOKEN = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || 'creatoros-verify-token';

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
    const body = req.body;

    // Check if it's a page or instagram event
    if (body.object === 'instagram') {
        if (body.entry && body.entry.length > 0) {
            for (const entry of body.entry) {
                if (entry.messaging && entry.messaging.length > 0) {
                    for (const webhookEvent of entry.messaging) {
                        const senderId = webhookEvent.sender.id;
                        const message = webhookEvent.message;

                        if (message && message.text) {
                            console.log(`[Webhook] Received message from ${senderId}: ${message.text}`);
                            
                            // Enqueue the message for asynchronous processing instead of synchronous execution
                            // We set exponential backoff: 5 retries, starting with 2 seconds delay
                            try {
                                await dmQueue.add('process-dm', {
                                    senderId: senderId,
                                    message: message.text,
                                    triggerKeyword: message.text.toLowerCase()
                                }, {
                                    attempts: 5,
                                    backoff: {
                                        type: 'exponential',
                                        delay: 2000
                                    }
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
