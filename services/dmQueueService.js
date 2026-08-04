const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');

// BullMQ requires a standard Redis connection string (socket protocol).
const REDIS_URI = process.env.REDIS_URI || process.env.REDIS_URL;

// Upstash REST credentials for other Redis clients (e.g., caching, rate-limiting).
const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;

function createFallbackQueue() {
    return {
        async add(jobName, jobData) {
            console.warn(
                `[DM Queue] Redis is not configured, skipping job "${jobName}" for sender ${jobData?.senderId || 'unknown'}.`
            );
            return {
                id: null,
                name: jobName,
                data: jobData,
            };
        },
    };
}

let dmQueue = createFallbackQueue();
let dmWorker = null;

// Send Instagram DM via Instagram Graph API
async function sendInstagramDM(recipientId, text, options = {}) {
    const accessToken = options.accessToken || process.env.INSTAGRAM_PAGE_ACCESS_TOKEN || process.env.INSTAGRAM_ACCESS_TOKEN;

    if (!accessToken) {
        throw new Error('Instagram Page Access Token is not configured (INSTAGRAM_PAGE_ACCESS_TOKEN / INSTAGRAM_ACCESS_TOKEN). Outbound DM delivery failed.');
    }

    if (!recipientId || !text) {
        throw new Error('Recipient ID and message text are required for Instagram DM delivery.');
    }

    const url = `https://graph.instagram.com/v19.0/me/messages?access_token=${accessToken}`;
    const payload = {
        recipient: { id: recipientId },
        message: { text }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        let errorData;
        try {
            errorData = JSON.parse(errorText);
        } catch (_) {
            errorData = {};
        }

        const statusCode = response.status;
        const message = errorData.error?.message || errorText || `Instagram API HTTP ${statusCode}`;
        const error = new Error(`Instagram DM Delivery Error (${statusCode}): ${message}`);
        error.code = statusCode;
        error.apiError = errorData.error;
        throw error;
    }

    return await response.json().catch(() => ({ success: true }));
}

// Initialize BullMQ worker and queue if a standard Redis URI is provided.
if (REDIS_URI) {
    const connection = new IORedis(REDIS_URI, {
        maxRetriesPerRequest: null,
        connectTimeout: 5000,
        lazyConnect: true,
    });

    // Add listeners for Redis connection events to improve observability.
    connection.on('error', (err) => {
        console.error('❌ Redis Connection Error:', err.message);
    });

    // Create the Queue only when Redis is explicitly configured.
    dmQueue = new Queue('dm-automation-queue', { connection });

    // Create the Worker only when Redis is available and not on Vercel.
    if (process.env.VERCEL === '1') {
        console.warn("📦 DM Worker disabled on Vercel to prevent hanging Redis connections. Use Vercel Cron/Webhooks instead.");
    } else {
        dmWorker = new Worker('dm-automation-queue', async (job) => {
            const { senderId, message, triggerKeyword, accessToken, responseText: customResponseText } = job.data;
            
            console.log(`[Worker] Processing job ${job.id} for sender ${senderId}`);

            try {
                // Send the DM via Instagram Graph API
                const responseText = customResponseText || `Hi! You triggered this via "${triggerKeyword}". Here is your resource!`;
                const result = await sendInstagramDM(senderId, responseText, { accessToken });
                
                console.log(`[Worker] Successfully processed job ${job.id}`);
                return result;
            } catch (error) {
                if (error.code === 429 || error.code === 503) {
                    console.warn(`[Worker] Rate limited/temporary failure (${error.code}) on job ${job.id}. Will retry...`);
                }
                throw error;
            }
        }, {
            connection,
            // Add rate limit pacing (e.g., max 50 jobs per 10 seconds)
            limiter: {
                max: 50,
                duration: 10000,
            }
        });

        // Event Listeners for logging
        dmWorker.on('completed', (job) => {
            console.log(`[Worker] Job ${job.id} for sender ${job.data.senderId} completed.`);
        });

        dmWorker.on('failed', (job, err) => {
            const jobId = job?.id || 'unknown';
            const errorMsg = err?.message || 'unknown error';
            console.error(`❌ Job with id ${jobId} has failed with ${errorMsg}`);
            if (job?.attemptsMade && job?.opts?.attempts && job.attemptsMade >= job.opts.attempts) {
                console.error(`🚨 ALARM: Job ${jobId} completely failed after ${job.attemptsMade} attempts.`);
            }
        });
    }

    console.log('📦 DM Automation Queue initialized');
} else {
    console.warn('📦 BullMQ DM Automation Queue disabled: REDIS_URI/REDIS_URL is not set.');
}

if (UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN) {
    console.log('📦 Upstash Redis REST client configured.');
}

module.exports = { dmQueue, dmWorker, sendInstagramDM };