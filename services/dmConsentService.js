const DmConsent = require("../model/dmConsent");

const OPT_OUT_KEYWORDS = new Set([
  "STOP",
  "UNSUBSCRIBE",
  "CANCEL",
  "QUIT",
  "END",
  "OPTOUT",
]);

const OPT_IN_KEYWORDS = new Set([
  "START",
  "YES",
  "UNSTOP",
]);

/**
 * Normalizes command text by trimming whitespace, converting to uppercase,
 * and stripping trailing punctuation (. or !).
 * @param {string} text
 * @returns {string}
 */
function normalizeCommand(text) {
  if (typeof text !== "string") {
    return "";
  }
  return text.trim().toUpperCase().replace(/[.!?]+$/, "");
}

/**
 * Recognizes explicit whole-message opt-out commands.
 * Does NOT match substrings (e.g. "stopper").
 * @param {string} text
 * @returns {boolean}
 */
function isOptOutKeyword(text) {
  const normalized = normalizeCommand(text);
  if (!normalized) return false;
  return OPT_OUT_KEYWORDS.has(normalized);
}

/**
 * Recognizes explicit whole-message opt-in commands.
 * @param {string} text
 * @returns {boolean}
 */
function isOptInKeyword(text) {
  const normalized = normalizeCommand(text);
  if (!normalized) return false;
  return OPT_IN_KEYWORDS.has(normalized);
}

/**
 * Records an opt-out event for a recipient.
 * Upserts the unique recipient consent document, sets status to "opted_out",
 * and appends an audit history entry.
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.creatorId
 * @param {string} [params.platform="instagram"]
 * @param {string} params.recipientId
 * @param {string} [params.keyword]
 * @returns {Promise<Object>}
 */
async function recordOptOut({
  creatorId,
  platform = "instagram",
  recipientId,
  keyword,
}) {
  if (!creatorId || !recipientId) {
    throw new Error("creatorId and recipientId are required to record opt-out");
  }

  const cleanKeyword = keyword ? String(keyword).trim() : null;
  const now = new Date();

  const filter = {
    creatorId,
    platform,
    recipientId: String(recipientId).trim(),
  };

  const update = {
    $set: {
      status: "opted_out",
      optedOutAt: now,
      lastOptOutKeyword: cleanKeyword,
    },
    $push: {
      history: {
        action: "opt_out",
        keyword: cleanKeyword,
        timestamp: now,
      },
    },
  };

  return await DmConsent.findOneAndUpdate(filter, update, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  });
}

/**
 * Records an opt-in event for a recipient.
 * Upserts the consent document, sets status to "opted_in",
 * clears optedOutAt, and appends an audit history entry.
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.creatorId
 * @param {string} [params.platform="instagram"]
 * @param {string} params.recipientId
 * @param {string} [params.keyword]
 * @returns {Promise<Object>}
 */
async function recordOptIn({
  creatorId,
  platform = "instagram",
  recipientId,
  keyword,
}) {
  if (!creatorId || !recipientId) {
    throw new Error("creatorId and recipientId are required to record opt-in");
  }

  const cleanKeyword = keyword ? String(keyword).trim() : null;
  const now = new Date();

  const filter = {
    creatorId,
    platform,
    recipientId: String(recipientId).trim(),
  };

  const update = {
    $set: {
      status: "opted_in",
      optedInAt: now,
      optedOutAt: null,
    },
    $push: {
      history: {
        action: "opt_in",
        keyword: cleanKeyword,
        timestamp: now,
      },
    },
  };

  return await DmConsent.findOneAndUpdate(filter, update, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  });
}

/**
 * Pre-send compliance check.
 * Returns false when the recipient has opted out.
 * Returns true when the recipient is opted in or has no existing consent record.
 * Database/infrastructure failures are NOT swallowed and will propagate so
 * that workers fail-closed and retry safely.
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.creatorId
 * @param {string} [params.platform="instagram"]
 * @param {string} params.recipientId
 * @returns {Promise<boolean>}
 */
async function canSend({ creatorId, platform = "instagram", recipientId }) {
  if (!creatorId || !recipientId) {
    throw new Error("creatorId and recipientId are required to check consent");
  }

  const doc = await DmConsent.findOne({
    creatorId,
    platform,
    recipientId: String(recipientId).trim(),
  });

  if (!doc) {
    return true;
  }

  return doc.status !== "opted_out";
}

/**
 * Retrieves the current consent status for a recipient.
 * Returns "opted_in" if no record exists.
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.creatorId
 * @param {string} [params.platform="instagram"]
 * @param {string} params.recipientId
 * @returns {Promise<string>} "opted_in" | "opted_out"
 */
async function getConsentStatus({
  creatorId,
  platform = "instagram",
  recipientId,
}) {
  if (!creatorId || !recipientId) {
    throw new Error("creatorId and recipientId are required to get consent status");
  }

  const doc = await DmConsent.findOne({
    creatorId,
    platform,
    recipientId: String(recipientId).trim(),
  });

  return doc ? doc.status : "opted_in";
}

module.exports = {
  isOptOutKeyword,
  isOptInKeyword,
  recordOptOut,
  recordOptIn,
  canSend,
  getConsentStatus,
};
