const { Queue, Worker } = require("bullmq");
const IORedis = require("ioredis");
const Creator = require("../model/creator");
const DmTrigger = require("../model/dmTrigger");
const {
  reserveDmDelivery,
  markDmDeliverySent,
  releaseDmDelivery,
} = require("./dmDeliveryService");

const REDIS_URI = process.env.REDIS_URI || process.env.REDIS_URL;
const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
const DEFAULT_DM_REQUEST_TIMEOUT_MS = 15000;

function createFallbackQueue() {
  return {
    async add(jobName, jobData) {
      console.warn(
        `[DM Queue] Redis is not configured, skipping job "${jobName}" for sender ${jobData?.senderId || "unknown"}.`,
      );
      return {
        id: null,
        name: jobName,
        data: jobData,
      };
    },
  };
}

const SENT_RECORD_ATTEMPTS = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Persists "sent" for a DM that has ALREADY been delivered. It retries a few times and never
 * throws: once Instagram accepted the message, failing the job would make BullMQ retry it and
 * send the same DM to the user again.
 */
async function recordDeliverySent(creatorId, eventId, messageId) {
  for (let attempt = 1; attempt <= SENT_RECORD_ATTEMPTS; attempt++) {
    try {
      await markDmDeliverySent(creatorId, eventId, messageId);
      return true;
    } catch (error) {
      console.error(
        `[Worker] Failed to record sent state for event ${eventId} (attempt ${attempt}/${SENT_RECORD_ATTEMPTS}): ${error.message}`,
      );
      if (attempt < SENT_RECORD_ATTEMPTS) await sleep(50 * attempt);
    }
  }
  return false;
}

/** Releases a reservation after a failed send without masking the original send error. */
async function releaseAfterFailedSend(creatorId, eventId) {
  try {
    await releaseDmDelivery(creatorId, eventId);
  } catch (releaseError) {
    // Not fatal: the lease expires on its own and a later retry can take the reservation over.
    console.error(
      `[Worker] Failed to release DM reservation for event ${eventId}: ${releaseError.message}`,
    );
  }
}

async function processDmJob(job) {
  const { senderId, recipientId, message, eventId } = job.data;

  console.log(`[Worker] Processing job ${job.id} for sender ${senderId}`);

  try {
    const creator = await Creator.findOne({
      platform: "instagram",
      platformId: recipientId,
    });
    if (!creator) {
      console.warn(
        `[Worker] No creator found for recipientId ${recipientId}, skipping job ${job.id}`,
      );
      return { skipped: true, reason: "unknown_creator" };
    }

    const triggers = await DmTrigger.find({
      creatorId: creator.userId,
      isActive: true,
    });
    const normalizedMessage = (message || "").toLowerCase();
    const matchedTrigger = triggers.find((t) =>
      normalizedMessage.includes(t.keyword),
    );

    if (!matchedTrigger) {
      console.log(
        `[Worker] No matching trigger for job ${job.id}, skipping reply`,
      );
      return { skipped: true, reason: "no_matching_trigger" };
    }

    const deliveryEventId = eventId || job.id;
    const reservation = await reserveDmDelivery(creator._id, deliveryEventId);

    if (!reservation.claimed) {
      if (reservation.delivery.status === "sent") {
        return { skipped: true, reason: "already_sent" };
      }

      // Another attempt holds a live lease. Completing the job as "skipped" here would drop
      // the DM for good if that attempt crashed, so fail it and let BullMQ retry: the retry
      // either finds the DM already sent or takes over the expired lease.
      const inProgress = new Error(
        `DM delivery for event ${deliveryEventId} is already in progress`,
      );
      inProgress.code = "DM_DELIVERY_IN_PROGRESS";
      throw inProgress;
    }

    let result;
    try {
      result = await sendInstagramDM(senderId, matchedTrigger.responseUrl, {
        accessToken: creator.accessToken,
      });
    } catch (error) {
      await releaseAfterFailedSend(creator._id, deliveryEventId);
      throw error;
    }

    // The DM is out. From here on nothing may release the reservation or fail the job.
    const recorded = await recordDeliverySent(
      creator._id,
      deliveryEventId,
      result.messageId,
    );

    console.log(`[Worker] Successfully processed job ${job.id}`);
    return recorded ? result : { ...result, deliveryRecorded: false };
  } catch (error) {
    if (error.status === 429 || error.code === 429) {
      console.warn(`[Worker] Rate limited on job ${job.id}. Will retry...`);
    }
    throw error;
  }
}

let dmQueue = createFallbackQueue();
let dmWorker = null;

function createRedisConnection(label) {
  const connection = new IORedis(REDIS_URI, {
    maxRetriesPerRequest: null,
    connectTimeout: 5000,
    lazyConnect: true,
  });

  connection.on("error", (err) => {
    console.error(`❌ Redis Connection Error (${label}):`, err.message);
  });

  return connection;
}

if (REDIS_URI) {
  const queueConnection = createRedisConnection("dm-queue");
  dmQueue = new Queue("dm-automation-queue", { connection: queueConnection });

  if (process.env.VERCEL === "1") {
    console.warn(
      "📦 DM Worker disabled on Vercel to prevent hanging Redis connections. Use Vercel Cron/Webhooks instead.",
    );
  } else {
    const workerConnection = createRedisConnection("dm-worker");

    dmWorker = new Worker("dm-automation-queue", processDmJob, {
      connection: workerConnection,
      limiter: {
        max: 50,
        duration: 10000,
      },
    });

    dmWorker.on("completed", (job) => {
      console.log(
        `[Worker] Job ${job.id} for sender ${job.data.senderId} completed.`,
      );
    });

    dmWorker.on("failed", (job, err) => {
      const jobId = job?.id || "unknown";
      const errorMsg = err?.message || "unknown error";
      console.error(`❌ Job with id ${jobId} has failed with ${errorMsg}`);
      if (
        job?.attemptsMade &&
        job?.opts?.attempts &&
        job.attemptsMade >= job.opts.attempts
      ) {
        console.error(
          `🚨 ALARM: Job ${jobId} completely failed after ${job.attemptsMade} attempts.`,
        );
      }
    });
  }

  console.log("📦 DM Automation Queue initialized");
} else {
  console.warn(
    "📦 BullMQ DM Automation Queue disabled: REDIS_URI/REDIS_URL is not set.",
  );
}

if (UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN) {
  console.log("📦 Upstash Redis REST client configured.");
}

async function sendInstagramDM(recipientId, text, options = {}) {
  const accessToken = options.accessToken;
  const appId = process.env.INSTAGRAM_APP_ID;
  const timeoutMs = options.timeoutMs ?? DEFAULT_DM_REQUEST_TIMEOUT_MS;

  if (!appId) {
    const error = new Error(
      "Instagram DM automation is not configured: INSTAGRAM_APP_ID is required.",
    );
    error.code = "DM_NOT_CONFIGURED";
    throw error;
  }

  if (!accessToken) {
    const error = new Error(
      "Instagram creator access token is required for outbound DM delivery.",
    );
    error.code = "DM_CREDENTIAL_MISSING";
    throw error;
  }

  if (!recipientId || !text) {
    throw new Error(
      "Recipient ID and message text are required for Instagram DM delivery.",
    );
  }

  let response;
  try {
    response = await fetch("https://graph.facebook.com/v21.0/me/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Ig-App-Id": appId,
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        messaging_type: "RESPONSE",
        message: { text },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      const timeoutError = new Error(
        `Instagram DM request timed out after ${timeoutMs}ms`,
        { cause: error },
      );
      timeoutError.code = "DM_REQUEST_TIMEOUT";
      throw timeoutError;
    }
    throw error;
  }

  if (!response.ok) {
    const errBody = await response.text();
    const error = new Error(
      `Instagram DM send failed: ${response.status} - ${errBody}`,
    );
    error.status = response.status;
    try {
      const parsed = JSON.parse(errBody);
      if (parsed?.error?.code) {
        error.code = parsed.error.code;
      }
    } catch (e) {
      // Preserve the HTTP status when the API returns a non-JSON body.
    }
    throw error;
  }

  const data = await response.json();
  return { success: true, messageId: data?.message_id || null };
}

module.exports = { dmQueue, dmWorker, sendInstagramDM, processDmJob };
