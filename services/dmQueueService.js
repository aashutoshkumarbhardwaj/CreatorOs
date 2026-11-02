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

    dmWorker = new Worker(
      "dm-automation-queue",
      async (job) => {
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
          const reservation = await reserveDmDelivery(
            creator._id,
            deliveryEventId,
          );

          if (!reservation.claimed) {
            return {
              skipped: true,
              reason:
                reservation.delivery.status === "sent"
                  ? "already_sent"
                  : "already_reserved",
            };
          }

          try {
            const responseText = matchedTrigger.responseUrl;
            const result = await sendInstagramDM(senderId, responseText, {
              accessToken: creator.accessToken,
            });

            await markDmDeliverySent(
              creator._id,
              deliveryEventId,
              result.messageId,
            );

            console.log(`[Worker] Successfully processed job ${job.id}`);
            return result;
          } catch (error) {
            await releaseDmDelivery(creator._id, deliveryEventId);
            throw error;
          }
        } catch (error) {
          if (error.status === 429 || error.code === 429) {
            console.warn(
              `[Worker] Rate limited on job ${job.id}. Will retry...`,
            );
          }
          throw error;
        }
      },
      {
        connection: workerConnection,
        limiter: {
          max: 50,
          duration: 10000,
        },
      },
    );

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

module.exports = { dmQueue, sendInstagramDM };
