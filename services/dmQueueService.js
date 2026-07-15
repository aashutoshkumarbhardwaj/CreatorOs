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

    // Create the Worker only when Redis is available.
    dmWorker = new Worker('dm-automation-queue', async (job) => {
        const { senderId, message, triggerKeyword } = job.data;
        
        console.log(`[Worker] Processing job ${job.id} for sender ${senderId}`);

        try {
            // Send the DM
            const responseText = `Hi! You triggered this via "${triggerKeyword}". Here is your resource!`;
            await sendInstagramDM(senderId, responseText);
            
            console.log(`[Worker] Successfully processed job ${job.id}`);
        } catch (error) {
            if (error.code === 429) {
                console.warn(`[Worker] Rate limited on job ${job.id}. Will retry...`);
                // Throwing the error tells BullMQ to retry the job based on backoff settings
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
        console.error(`❌ Job with id ${job.id} has failed with ${err.message}`);
        // If we've exhausted all retries, we could log this to the DB to show on the CRM dashboard
        if (job.attemptsMade >= job.opts.attempts) {
            console.error(`🚨 ALARM: Job ${job.id} completely failed after ${job.attemptsMade} attempts.`);
        }
    });

    console.log('📦 DM Automation Queue initialized');
} else {
    console.warn('📦 BullMQ DM Automation Queue disabled: REDIS_URI/REDIS_URL is not set.');
}

if (UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN) {
    console.log('📦 Upstash Redis REST client configured.');
}

// Optional: you can define a dummy function for actually sending a DM
async function sendInstagramDM(recipientId, text) {
    // In reality, this would make an Axios/Fetch call to the Graph API
    // e.g. await axios.post(`https://graph.facebook.com/v19.0/me/messages`, ...)
    console.log(`[Instagram API] Sending DM to ${recipientId}: "${text}"`);
    return Promise.resolve(); // Simulate a successful API call
}