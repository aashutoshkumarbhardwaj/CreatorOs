/**
 * tests/services/commentDmService.test.js
 *
 * Unit tests for the OpenReply-style comment-to-DM automation service.
 */

jest.mock('../../model/dmTrigger');
jest.mock('../../services/dmDeliveryService');
jest.mock('../../services/dmQueueService');

const DmTrigger = require('../../model/dmTrigger');
const { reserveDmDelivery, markDmDeliverySent, releaseDmDelivery } = require('../../services/dmDeliveryService');
const { sendInstagramDM } = require('../../services/dmQueueService');
const {
  handleCommentTrigger,
  matchesKeyword,
  META_HOURLY_DM_CAP,
} = require('../../services/commentDmService');

const mongoose = require('mongoose');

// ─── matchesKeyword ────────────────────────────────────────────────────────────
describe('matchesKeyword', () => {
  it('partial match returns true when keyword appears in text', () => {
    expect(matchesKeyword('Please send me the LINK!', 'link', 'partial')).toBe(true);
  });

  it('partial match returns false when keyword is absent', () => {
    expect(matchesKeyword('Nice photo!', 'link', 'partial')).toBe(false);
  });

  it('exact match returns true for whole-word occurrence', () => {
    expect(matchesKeyword('Send LINK please', 'link', 'exact')).toBe(true);
  });

  it('exact match returns false for partial substring', () => {
    // "linking" contains "link" but not as a whole word followed by a boundary — actually "link" IS a word boundary prefix here
    // let's use a clear case: "links" should not match "link" exactly
    expect(matchesKeyword('here are the links', 'link', 'exact')).toBe(false);
  });

  it('handles empty text gracefully', () => {
    expect(matchesKeyword('', 'link', 'partial')).toBe(false);
  });

  it('handles null text gracefully', () => {
    expect(matchesKeyword(null, 'link', 'partial')).toBe(false);
  });
});

// ─── handleCommentTrigger ─────────────────────────────────────────────────────
describe('handleCommentTrigger', () => {
  const creatorId = new mongoose.Types.ObjectId();
  const creator = {
    _id: creatorId,
    userId: creatorId,
    accessToken: 'test-token',
  };

  const baseTrigger = {
    _id: new mongoose.Types.ObjectId(),
    keyword: 'link',
    matchType: 'partial',
    responseText: 'Here is your link!',
    commentReply: null,
    isActive: true,
    hourlyQuota: { count: 0, windowStart: null },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips when no comment triggers are configured for the post', async () => {
    DmTrigger.find.mockResolvedValue([]);

    const result = await handleCommentTrigger({
      commentId: 'c1',
      commentText: 'link',
      commenterId: 'u1',
      commenterUsername: 'alice',
      postId: 'p1',
      creator,
    });

    expect(result).toEqual({ skipped: true, reason: 'no_comment_triggers' });
  });

  it('skips when the comment text does not match any keyword', async () => {
    DmTrigger.find.mockResolvedValue([{ ...baseTrigger }]);

    const result = await handleCommentTrigger({
      commentId: 'c2',
      commentText: 'Nice photo!',
      commenterId: 'u1',
      commenterUsername: 'alice',
      postId: 'p1',
      creator,
    });

    expect(result).toEqual({ skipped: true, reason: 'no_keyword_match' });
  });

  it('skips when hourly cap is reached', async () => {
    DmTrigger.find.mockResolvedValue([{
      ...baseTrigger,
      hourlyQuota: { count: META_HOURLY_DM_CAP, windowStart: new Date() },
    }]);
    DmTrigger.updateOne = jest.fn();

    const result = await handleCommentTrigger({
      commentId: 'c3',
      commentText: 'send link',
      commenterId: 'u1',
      commenterUsername: 'alice',
      postId: 'p1',
      creator,
    });

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('hourly_cap_reached');
  });

  it('skips when DM is already sent (duplicate comment event)', async () => {
    DmTrigger.find.mockResolvedValue([{ ...baseTrigger }]);
    DmTrigger.updateOne = jest.fn().mockResolvedValue({});
    reserveDmDelivery.mockResolvedValue({
      claimed: false,
      delivery: { status: 'sent' },
    });

    const result = await handleCommentTrigger({
      commentId: 'c4',
      commentText: 'link please',
      commenterId: 'u1',
      commenterUsername: 'alice',
      postId: 'p1',
      creator,
    });

    expect(result).toEqual({ skipped: true, reason: 'already_sent' });
  });

  it('sends DM when a matching trigger is found and quota is available', async () => {
    DmTrigger.find.mockResolvedValue([{ ...baseTrigger }]);
    DmTrigger.updateOne = jest.fn().mockResolvedValue({});
    reserveDmDelivery.mockResolvedValue({ claimed: true, delivery: {} });
    sendInstagramDM.mockResolvedValue({ success: true, messageId: 'msg-123' });
    markDmDeliverySent.mockResolvedValue();

    const result = await handleCommentTrigger({
      commentId: 'c5',
      commentText: 'send me the link!',
      commenterId: 'u1',
      commenterUsername: 'alice',
      postId: 'p1',
      creator,
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg-123');
    expect(sendInstagramDM).toHaveBeenCalledWith('u1', 'Here is your link!', {
      accessToken: 'test-token',
    });
  });

  it('personalises DM with {username} when commenterUsername is provided', async () => {
    DmTrigger.find.mockResolvedValue([{
      ...baseTrigger,
      responseText: 'Hey {username}, here is your link!',
    }]);
    DmTrigger.updateOne = jest.fn().mockResolvedValue({});
    reserveDmDelivery.mockResolvedValue({ claimed: true, delivery: {} });
    sendInstagramDM.mockResolvedValue({ success: true, messageId: 'msg-456' });
    markDmDeliverySent.mockResolvedValue();

    await handleCommentTrigger({
      commentId: 'c6',
      commentText: 'link',
      commenterId: 'u2',
      commenterUsername: 'bob',
      postId: 'p1',
      creator,
    });

    expect(sendInstagramDM).toHaveBeenCalledWith('u2', 'Hey bob, here is your link!', expect.any(Object));
  });

  it('releases DM delivery reservation if sendInstagramDM throws', async () => {
    DmTrigger.find.mockResolvedValue([{ ...baseTrigger }]);
    DmTrigger.updateOne = jest.fn().mockResolvedValue({});
    reserveDmDelivery.mockResolvedValue({ claimed: true, delivery: {} });
    sendInstagramDM.mockRejectedValue(new Error('Meta API error'));
    releaseDmDelivery.mockResolvedValue();

    await expect(
      handleCommentTrigger({
        commentId: 'c7',
        commentText: 'link',
        commenterId: 'u1',
        commenterUsername: 'alice',
        postId: 'p1',
        creator,
      }),
    ).rejects.toThrow('Meta API error');

    expect(releaseDmDelivery).toHaveBeenCalledWith(creatorId, 'c7');
  });

  it('throws when required params are missing', async () => {
    await expect(
      handleCommentTrigger({ commentId: null, commenterId: null, postId: null, creator: null }),
    ).rejects.toThrow();
  });
});
