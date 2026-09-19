jest.mock('../services/dmQueueService', () => ({
  dmQueue: {
    add: jest.fn().mockResolvedValue({ id: 'job-id' }),
  },
}));

describe('Instagram webhook event IDs', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('keeps distinct message IDs when a request-level event ID is shared', () => {
    const { buildEventId } = require('../controller/instagramWebhookController');

    const firstMessage = {
      mid: 'mid.first',
      text: 'first',
    };
    const secondMessage = {
      mid: 'mid.second',
      text: 'second',
    };

    const firstEventId = buildEventId('sender-1', 'creator-1', firstMessage, 1000);
    const secondEventId = buildEventId('sender-1', 'creator-1', secondMessage, 1001);

    expect(firstEventId).not.toBe(secondEventId);
  });

  it('produces a stable ID for the same message on webhook replay', () => {
    const { buildEventId } = require('../controller/instagramWebhookController');

    const message = {
      mid: 'mid.replay',
      text: 'hello',
    };

    expect(buildEventId('sender-1', 'creator-1', message, 2000))
      .toBe(buildEventId('sender-1', 'creator-1', message, 9999));
  });
});
