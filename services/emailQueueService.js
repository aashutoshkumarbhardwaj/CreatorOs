const { Queue, Worker } = require('bullmq');
const { sendInvitationEmail } = require('../utils/email');

const REDIS_URI = process.env.REDIS_URI;

let emailQueue;

if (REDIS_URI) {
    emailQueue = new Queue('emailQueue', {
        connection: {
            url: REDIS_URI
        }
    });

    const emailWorker = new Worker('emailQueue', async (job) => {
        const { to, inviterName, projectName, inviteUrl, personalMessage } = job.data;
        console.log(`[EmailWorker] Processing job ${job.id} for ${to}`);
        
        await sendInvitationEmail({
            to,
            inviterName,
            projectName,
            inviteUrl,
            personalMessage
        });
        
        console.log(`[EmailWorker] Successfully processed job ${job.id}`);
    }, {
        connection: {
            url: REDIS_URI
        }
    });

    emailWorker.on('failed', (job, err) => {
        console.error(`[EmailWorker] Job ${job.id} failed:`, err.message);
    });

    console.log('📦 BullMQ Email Queue initialized');
} else {
    console.warn('📦 BullMQ Email Queue disabled because REDIS_URI is not set.');
}

async function addEmailJob(emailData) {
    if (emailQueue) {
        await emailQueue.add('sendEmail', emailData, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 2000
            }
        });
    } else {
        // Fallback to sending synchronously if no Redis
        console.warn('BullMQ not initialized, sending email synchronously.');
        await sendInvitationEmail(emailData);
    }
}

module.exports = {
    emailQueue,
    addEmailJob
};
