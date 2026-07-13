const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');

const REDIS_URI = process.env.REDIS_URI;

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

if (REDIS_URI) {
    const connection = new IORedis(REDIS_URI, {
        maxRetriesPerRequest: null,
        connectTimeout: 5000,
        lazyConnect: true,
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
        // console.log(`Job with id ${job.id} has been completed`);
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
    console.warn('📦 DM Automation Queue disabled because REDIS_URI is not set.');
}

// Optional: you can define a dummy function for actually sending a DM
async function sendInstagramDM(recipientId, text) {
    // In reality, this would make an Axios/Fetch call to the Graph API
    // e.g. await axios.post(`https://graph.facebook.com/v19.0/me/messages`, ...)
    console.log(`[Instagram API] Sending DM to ${recipientId}: "${text}"`);
    
    
    return true;
}

module.exports = {
    dmQueue,
};
