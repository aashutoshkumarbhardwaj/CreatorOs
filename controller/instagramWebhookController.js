```javascript
const dmQueueService = require("../services/dmQueueService");
const dmConsentService = require("../services/dmConsentService");
const Creator = require("../model/creator");
const asyncHandler = require("../utils/asyncHandler");

const crypto = require("crypto");

// Prefer exported dmQueue when present (#981 may add the export separately).
const dmQueue = dmQueueService && dmQueueService.dmQueue;

// In-memory deduplication set for processed webhook event IDs
// TTL: 5 minutes to prevent unbounded memory growth
const processedEvents = new Map();
const EVENT_TTL_MS = 5 * 60 * 1000;

const cleanupInterval = setInterval(() => {
  const now = Date.now();

  for (const [eventId, timestamp] of processedEvents) {
    if (now - timestamp > EVENT_TTL_MS) {
      processedEvents.delete(eventId);
    }
  }
}, 60 * 1000);

cleanupInterval.unref();

function hasProcessed(eventId) {
  if (!eventId) return false;
  return processedEvents.has(eventId);
}

function markProcessed(eventId) {
  if (!eventId) return;
  processedEvents.set(eventId, Date.now());
}

function clearProcessedEvents() {
  processedEvents.clear();
}

function buildEventId(senderId, recipientId, message, timestamp) {
  const messageId = message?.mid;

  const stableIdentity = messageId
    ? `${recipientId}:${senderId}:mid:${messageId}`
    : `${recipientId}:${senderId}:message:${message?.text || ""}:timestamp:${timestamp || ""}`;

  return crypto.createHash("sha256").update(stableIdentity).digest("hex");
}

// Verify the webhook from Meta
const verifyWebhook = (req, res) => {
  const VERIFY_TOKEN = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;

  if (!VERIFY_TOKEN) {
    console.error(
      "[Webhook] INSTAGRAM_WEBHOOK_VERIFY_TOKEN is not configured",
    );
    return res.sendStatus(500);
  }

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("WEBHOOK_VERIFIED");
      return res.status(200).send(challenge);
    }

    return res.sendStatus(403);
  }

  return res.status(400).send("Missing hub variables");
};

const verifyWebhookSignature = (req, res, next) => {
  const signature = req.headers["x-hub-signature-256"];

  if (!signature) {
    console.warn("[Webhook] Missing X-Hub-Signature-256 header");
    return res.sendStatus(403);
  }

  const APP_SECRET = process.env.INSTAGRAM_APP_SECRET;

  if (!APP_SECRET) {
    console.error("[Webhook] INSTAGRAM_APP_SECRET is not configured");
    return res.sendStatus(500);
  }

  const payload = req.rawBody;

  if (!payload) {
    console.error(
      "[Webhook] Raw body is missing. Ensure express.json({verify: ...}) is configured.",
    );
    return res.sendStatus(500);
  }

  const expectedSignature =
    "sha256=" +
    crypto.createHmac("sha256", APP_SECRET).update(payload).digest("hex");

  try {
    if (
      crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      )
    ) {
      return next();
    }
  } catch (error) {
    // timingSafeEqual throws when buffer lengths do not match.
  }

  console.warn("[Webhook] Invalid signature");
  return res.sendStatus(403);
};

async function enqueueDmEvent(
  eventId,
  senderId,
  messageText,
  recipientId,
) {
  if (!dmQueue || typeof dmQueue.add !== "function") {
    throw new Error("DM queue unavailable");
  }

  await dmQueue.add(
    "process-dm",
    {
      senderId,
      recipientId,
      message: messageText,
      triggerKeyword: messageText.toLowerCase(),
      eventId,
    },
    {
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      jobId: eventId,
    },
  );
}

// Handle incoming webhook events
const handleWebhook = asyncHandler(async (req, res) => {
  const body = req.body || {};
  let enqueueFailed = false;

  if (body.object !== "instagram") {
    return res.sendStatus(404);
  }

  if (body.entry && body.entry.length > 0) {
    for (const entry of body.entry) {
      const recipientId = entry.id;

      if (!entry.messaging || entry.messaging.length === 0) {
```
