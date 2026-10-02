/**
 * commentDmService.js
 *
 * OpenReply-style comment-to-DM automation (see github.com/diwenne/openreply).
 *
 * When an Instagram user comments a keyword on a watched post:
 *   1. Find matching active DmTrigger for that creator + postId + keyword.
 *   2. Enforce Meta's 750 private-replies-per-hour cap per creator (rolling window).
 *   3. Optionally post a public reply under the triggering comment.
 *   4. Send the DM via the Graph API, deduplicated through dmDeliveryService.
 */

const DmTrigger = require('../model/dmTrigger');
const { reserveDmDelivery, markDmDeliverySent, releaseDmDelivery } = require('./dmDeliveryService');
const { sendInstagramDM } = require('./dmQueueService');

/** Meta's documented hourly cap for private replies per creator account. */
const META_HOURLY_DM_CAP = 750;
const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Checks whether a trigger text matches a keyword according to matchType.
 *
 * @param {string} text          - Raw comment or DM text (will be lowercased).
 * @param {string} keyword       - The keyword to look for (already lowercased in schema).
 * @param {'partial'|'exact'} matchType
 * @returns {boolean}
 */
function matchesKeyword(text, keyword, matchType = 'partial') {
  const normalised = (text || '').toLowerCase().trim();
  if (matchType === 'exact') {
    // Whole-word match using word boundaries
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`).test(normalised);
  }
  // Default: partial — keyword appears anywhere in the text
  return normalised.includes(keyword);
}

/**
 * Check and increment per-trigger rolling-hour quota.
 * Resets the counter if the window has expired.
 *
 * @param {import('mongoose').Document} trigger
 * @returns {Promise<boolean>} true if under cap, false if cap reached.
 */
async function checkAndIncrementQuota(trigger) {
  const now = Date.now();
  const windowStart = trigger.hourlyQuota?.windowStart
    ? new Date(trigger.hourlyQuota.windowStart).getTime()
    : 0;

  const windowExpired = now - windowStart >= ONE_HOUR_MS;
  const currentCount = windowExpired ? 0 : (trigger.hourlyQuota?.count || 0);

  if (currentCount >= META_HOURLY_DM_CAP) {
    return false; // rate-limited
  }

  await DmTrigger.updateOne(
    { _id: trigger._id },
    {
      $set: {
        'hourlyQuota.count': currentCount + 1,
        'hourlyQuota.windowStart': windowExpired ? new Date(now) : trigger.hourlyQuota.windowStart,
      },
    },
  );

  return true;
}

/**
 * Post a public comment reply via the Graph API.
 *
 * @param {string} commentId    - The Instagram comment ID to reply to.
 * @param {string} replyText    - The text to post as a reply.
 * @param {string} accessToken  - Creator's Instagram access token.
 */
async function postPublicCommentReply(commentId, replyText, accessToken) {
  const response = await fetch(
    `https://graph.facebook.com/v21.0/${commentId}/replies`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: replyText }),
      signal: AbortSignal.timeout(10000),
    },
  );

  if (!response.ok) {
    const errBody = await response.text();
    const err = new Error(
      `Failed to post public comment reply: ${response.status} - ${errBody}`,
    );
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  return { success: true, replyId: data?.id || null };
}

/**
 * Personalise a message template by substituting `{username}`.
 *
 * @param {string} template
 * @param {string} username
 * @returns {string}
 */
function personalise(template, username) {
  if (!template) return template;
  return template.replace(/\{username\}/gi, username || '');
}

/**
 * Main entry point called from the Instagram webhook handler when
 * a `comments` change event is received.
 *
 * @param {object} params
 * @param {string} params.commentId     - Instagram comment ID
 * @param {string} params.commentText   - Raw comment text
 * @param {string} params.commenterId   - Instagram user ID of the commenter
 * @param {string} params.commenterUsername - Handle of the commenter
 * @param {string} params.postId        - Instagram media ID the comment is on
 * @param {string} params.creatorIgId   - Instagram user ID of the creator (page owner)
 * @param {object} params.creator       - Mongoose Creator document (must have accessToken)
 * @returns {Promise<object>} Result summary
 */
async function handleCommentTrigger({
  commentId,
  commentText,
  commenterId,
  commenterUsername,
  postId,
  creatorIgId,
  creator,
}) {
  if (!commentId || !commenterId || !postId || !creator) {
    throw new Error('commentId, commenterId, postId, and creator are required.');
  }

  // 1. Find active comment triggers for this creator + post
  const triggers = await DmTrigger.find({
    creatorId: creator.userId,
    triggerSource: 'comment',
    postId,
    isActive: true,
  });

  if (triggers.length === 0) {
    return { skipped: true, reason: 'no_comment_triggers' };
  }

  // 2. Find the first matching keyword trigger
  const matchedTrigger = triggers.find((t) =>
    matchesKeyword(commentText, t.keyword, t.matchType),
  );

  if (!matchedTrigger) {
    return { skipped: true, reason: 'no_keyword_match' };
  }

  // 3. Enforce hourly rate limit (Meta cap: 750 DMs/hr)
  const underCap = await checkAndIncrementQuota(matchedTrigger);
  if (!underCap) {
    console.warn(
      `[CommentDM] Creator ${creator._id} has hit the hourly DM cap. Queuing overflow for later.`,
    );
    return { skipped: true, reason: 'hourly_cap_reached', triggerId: matchedTrigger._id };
  }

  // 4. Deduplicate — use commentId as eventId so we never DM twice for the same comment
  const reservation = await reserveDmDelivery(creator._id, commentId);
  if (!reservation.claimed) {
    return {
      skipped: true,
      reason: reservation.delivery.status === 'sent' ? 'already_sent' : 'already_reserved',
    };
  }

  let dmResult = null;
  try {
    // 5. Personalise the DM text and send
    const dmText = personalise(matchedTrigger.responseText, commenterUsername);

    dmResult = await sendInstagramDM(commenterId, dmText, {
      accessToken: creator.accessToken,
    });

    await markDmDeliverySent(creator._id, commentId, dmResult.messageId);

    // 6. Optionally post a public comment reply
    if (matchedTrigger.commentReply) {
      const replyText = personalise(matchedTrigger.commentReply, commenterUsername);
      try {
        await postPublicCommentReply(commentId, replyText, creator.accessToken);
      } catch (replyErr) {
        // Non-fatal: log but don't fail the whole operation
        console.error(
          `[CommentDM] Public comment reply failed for comment ${commentId}:`,
          replyErr.message,
        );
      }
    }

    console.log(
      `[CommentDM] DM sent to ${commenterId} for comment ${commentId} (trigger: ${matchedTrigger._id})`,
    );

    return {
      success: true,
      triggerId: matchedTrigger._id,
      messageId: dmResult.messageId,
      commentId,
    };
  } catch (error) {
    await releaseDmDelivery(creator._id, commentId);
    throw error;
  }
}

module.exports = {
  handleCommentTrigger,
  matchesKeyword,
  postPublicCommentReply,
  META_HOURLY_DM_CAP,
};
