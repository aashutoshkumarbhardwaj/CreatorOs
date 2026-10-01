const DmAutomationRule = require("../model/dmAutomationRule");
const { escapeRegex } = require("../utils/escapeRegex");

// Cooldown tracker in memory with key: `${ruleId}:${senderId}` -> timestamp
const userCooldownMap = new Map();

/**
 * Match incoming message against rule trigger conditions
 */
function matchesTrigger(text, rule) {
  if (!text || !rule || !rule.triggerKeywords || rule.triggerKeywords.length === 0) {
    return false;
  }
  const clean = text.trim().toLowerCase();

  if (rule.matchType === "exact") {
    return rule.triggerKeywords.some((kw) => clean === kw.toLowerCase());
  }

  if (rule.matchType === "contains") {
    return rule.triggerKeywords.some((kw) => clean.includes(kw.toLowerCase()));
  }

  if (rule.matchType === "regex") {
    return rule.triggerKeywords.some((kw) => {
      try {
        const pattern = new RegExp(kw, "i");
        return pattern.test(clean);
      } catch (err) {
        return false;
      }
    });
  }

  return false;
}

/**
 * Check if sender is in cooldown window for this rule
 */
function isUserInCooldown(ruleId, senderId, cooldownMinutes) {
  const key = `${ruleId}:${senderId}`;
  const lastTime = userCooldownMap.get(key);
  if (!lastTime) return false;

  const diffMinutes = (Date.now() - lastTime) / (1000 * 60);
  return diffMinutes < cooldownMinutes;
}

/**
 * Update cooldown timestamp for user
 */
function setUserCooldown(ruleId, senderId) {
  const key = `${ruleId}:${senderId}`;
  userCooldownMap.set(key, Date.now());

  // Memory hygiene: prune older entries every 1000 items
  if (userCooldownMap.size > 5000) {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const [k, v] of userCooldownMap.entries()) {
      if (v < cutoff) userCooldownMap.delete(k);
    }
  }
}

/**
 * Render template variables safely
 */
function renderReplyTemplate(template, senderName, creatorName) {
  return template
    .replace(/\{\{\s*senderName\s*\}\}/gi, senderName || "there")
    .replace(/\{\{\s*creatorName\s*\}\}/gi, creatorName || "Creator");
}

/**
 * Evaluate incoming message against all active creator rules
 */
async function evaluateMessage({ creatorId, senderId, senderName, messageText }) {
  if (!creatorId || !senderId || !messageText) {
    return { matched: false, reason: "Missing required parameters" };
  }

  const rules = await DmAutomationRule.find({ creatorId, status: "active" });
  for (const rule of rules) {
    if (!matchesTrigger(messageText, rule)) {
      continue;
    }

    if (!rule.canSendToday()) {
      return { matched: true, sent: false, ruleId: rule._id, reason: "Daily send limit reached" };
    }

    if (isUserInCooldown(rule._id, senderId, rule.cooldownMinutesPerUser)) {
      return { matched: true, sent: false, ruleId: rule._id, reason: "Sender in cooldown period" };
    }

    const replyMessage = renderReplyTemplate(rule.responseTemplate, senderName);

    // Record usage
    rule.recordSend();
    await rule.save();
    setUserCooldown(rule._id, senderId);

    return {
      matched: true,
      sent: true,
      ruleId: rule._id,
      ruleName: rule.name,
      replyMessage,
      delaySeconds: rule.delaySeconds,
    };
  }

  return { matched: false, reason: "No matching rules found" };
}

module.exports = {
  matchesTrigger,
  isUserInCooldown,
  setUserCooldown,
  renderReplyTemplate,
  evaluateMessage,
};
