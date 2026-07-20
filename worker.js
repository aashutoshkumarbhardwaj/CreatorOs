const { Worker } = require('bullmq');
const { redisConnection } = require('./utils/queue');

if (process.env.VERCEL === '1') {
    console.warn("📦 Workers are disabled on Vercel. Use Vercel Cron/Webhooks for background jobs.");
} else if (!redisConnection) {
    console.warn('📦 Workers disabled: Redis connection is not configured.');
} else {
    // Worker for email Queue
    const emailWorker = new Worker('emailQueue', async job => {
        console.log(`Processing email job ${job.id} of type ${job.name}`);
        console.log(`Sending email to ${job.data.email}...`);
        // Mock sending email
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log(`Email job ${job.id} processed successfully`);
    }, { connection: redisConnection });

    emailWorker.on('completed', job => {
        console.log(`${job.id} has completed!`);
    });

    emailWorker.on('failed', (job, err) => {
        console.log(`${job.id} has failed with ${err.message}`);
    });

    // Worker for AI tasks Queue
    const aiTaskWorker = new Worker('aiTaskQueue', async job => {
        console.log(`Processing AI job ${job.id} of type ${job.name}`);
        // Mock AI processing
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log(`AI job ${job.id} processed successfully`);
    }, { connection: redisConnection });

    aiTaskWorker.on('completed', job => {
        console.log(`${job.id} has completed!`);
    });

    aiTaskWorker.on('failed', (job, err) => {
        console.log(`${job.id} has failed with ${err.message}`);
    });

    console.log('Workers started successfully, listening for jobs...');
}
