const {
  generateAISuggestions,
  generateTemplateSuggestions,
  extractKeywords,
  SuggestionProviderError,
  getSuggestions,
  getPage,
} = require('../../controller/suggestionController');

describe('suggestionController AI provenance', () => {
  const originalFetch = global.fetch;
  let originalOpenAIKey;
  let originalTemplateMode;

  beforeEach(() => {
    jest.clearAllMocks();
    originalOpenAIKey = process.env.OPENAI_API_KEY;
    originalTemplateMode = process.env.SUGGESTIONS_TEMPLATE_MODE;
    delete process.env.OPENAI_API_KEY;
    delete process.env.SUGGESTIONS_TEMPLATE_MODE;
  });

  afterEach(() => {
    if (originalOpenAIKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAIKey;
    }
    if (originalTemplateMode === undefined) {
      delete process.env.SUGGESTIONS_TEMPLATE_MODE;
    } else {
      process.env.SUGGESTIONS_TEMPLATE_MODE = originalTemplateMode;
    }
    global.fetch = originalFetch;
  });

  function mockOpenAIResponse(content, { ok = true, status = 200 } = {}) {
    global.fetch = jest.fn().mockResolvedValue({
      ok,
      status,
      statusText: ok ? 'OK' : 'Bad Gateway',
      json: async () => ({
        choices: [
          {
            message: { content },
          },
        ],
      }),
    });
  }

  function createResponse() {
    return {
      status: jest.fn().mockReturnThis(),
      render: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  }

  it('returns openai-sourced suggestions on a successful provider response', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockOpenAIResponse(JSON.stringify({
      captions: ['Caption one', 'Caption two'],
      hashtags: ['#one', '#two'],
      songs: [{ title: 'Verified Track', mood: 'upbeat' }],
    }));

    const result = await generateAISuggestions('morning coffee');

    expect(result.source).toBe('openai');
    expect(result.captions).toEqual(['Caption one', 'Caption two']);
    expect(result.hashtags).toEqual(['#one', '#two']);
    expect(result.songs).toEqual([{ title: 'Verified Track', mood: 'upbeat' }]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('throws NOT_CONFIGURED when the API key is missing and template mode is off', async () => {
    await expect(generateAISuggestions('travel vlog')).rejects.toMatchObject({
      name: 'SuggestionProviderError',
      code: 'NOT_CONFIGURED',
      retryable: false,
      statusCode: 503,
    });
  });

  it('serves labelled template mode without songs when enabled and unconfigured', async () => {
    process.env.SUGGESTIONS_TEMPLATE_MODE = 'true';

    const result = await generateAISuggestions('summer festival');

    expect(result.source).toBe('template');
    expect(result.captions.length).toBeGreaterThan(0);
    expect(result.hashtags.length).toBeGreaterThan(0);
    expect(result.songs).toEqual([]);
    expect(result.captions.join(' ')).not.toMatch(/DJ Mix/);
  });

  it('throws PROVIDER_ERROR on non-OK provider responses when template mode is off', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockOpenAIResponse('{}', { ok: false, status: 502 });

    await expect(generateAISuggestions('desk setup')).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
      retryable: true,
    });
  });

  it('throws INVALID_RESPONSE on unparseable provider JSON when template mode is off', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockOpenAIResponse('not-json-at-all');

    await expect(generateAISuggestions('desk setup')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('throws TIMEOUT when the provider aborts and template mode is off', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    global.fetch = jest.fn().mockImplementation(() => {
      const err = new Error('Aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    });

    await expect(generateAISuggestions('desk setup')).rejects.toMatchObject({
      code: 'TIMEOUT',
    });
  });

  it('falls back to labelled templates on provider failure when template mode is on', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.SUGGESTIONS_TEMPLATE_MODE = 'true';
    mockOpenAIResponse('not-json-at-all');

    const result = await generateAISuggestions('creator tips');

    expect(result.source).toBe('template');
    expect(result.songs).toEqual([]);
  });

  it('generateTemplateSuggestions never invents song titles', () => {
    const result = generateTemplateSuggestions('beach sunset');
    expect(result.source).toBe('template');
    expect(result.songs).toEqual([]);
  });

  it('getSuggestions returns JSON unavailable state for missing configuration', async () => {
    const req = {
      body: { topic: 'growth tips' },
      get: () => 'application/json',
      xhr: false,
      accepts: () => false,
    };
    const res = createResponse();

    await getSuggestions(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      code: 'NOT_CONFIGURED',
      retryable: false,
    }));
    expect(res.render).not.toHaveBeenCalled();
  });

  it('getSuggestions renders HTML with template provenance when enabled', async () => {
    process.env.SUGGESTIONS_TEMPLATE_MODE = 'true';
    const req = {
      body: { topic: 'growth tips' },
      get: () => 'text/html',
      xhr: false,
      accepts: () => 'html',
    };
    const res = createResponse();

    await getSuggestions(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.render).toHaveBeenCalledWith(
      'suggestions',
      expect.objectContaining({
        source: 'template',
        error: null,
        result: expect.objectContaining({
          source: 'template',
          songs: [],
        }),
      })
    );
  });

  it('getSuggestions returns successful JSON with openai provenance', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockOpenAIResponse(JSON.stringify({
      captions: ['A'],
      hashtags: ['#a'],
      songs: [{ title: 'Song', mood: 'chill' }],
    }));

    const req = {
      body: { topic: 'growth tips' },
      get: () => 'application/json',
      xhr: false,
      accepts: () => false,
    };
    const res = createResponse();

    await getSuggestions(req, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      source: 'openai',
      isTemplate: false,
      result: expect.objectContaining({
        captions: ['A'],
        hashtags: ['#a'],
        songs: [{ title: 'Song', mood: 'chill' }],
      }),
    }));
  });

  it('getPage renders a clean empty suggestions page', () => {
    const req = {};
    const res = createResponse();

    getPage(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.render).toHaveBeenCalledWith(
      'suggestions',
      expect.objectContaining({
        result: null,
        error: null,
        source: null,
      })
    );
  });

  it('SuggestionProviderError exposes actionable metadata', () => {
    const err = new SuggestionProviderError('boom', { code: 'PROVIDER_ERROR' });
    expect(err.retryable).toBe(true);
    expect(err.statusCode).toBe(503);
    expect(err.code).toBe('PROVIDER_ERROR');
  });

  it('extractKeywords extracts top keywords excluding stopwords', () => {
    const keywords = extractKeywords('Building a viral TikTok strategy for audience growth and digital marketing');
    expect(keywords).toContain('building');
    expect(keywords).toContain('tiktok');
    expect(keywords).toContain('strategy');
    expect(keywords).not.toContain('a');
    expect(keywords).not.toContain('and');
    expect(keywords.length).toBeLessThanOrEqual(6);
  });

  it('generateTemplateSuggestions returns keywords, CTAs, and emojis for options input', () => {
    const result = generateTemplateSuggestions({
      topic: 'desk setup inspiration',
      platform: 'youtube',
      tone: 'professional',
      length: 'long',
      language: 'english',
      includeEmojis: true,
      includeCta: true
    });

    expect(result.source).toBe('template');
    expect(result.captions.length).toBe(5);
    expect(result.hashtags.length).toBeGreaterThan(0);
    expect(result.keywords).toContain('desk');
    expect(result.keywords).toContain('setup');
    expect(result.ctas.length).toBe(4);
    expect(result.emojis.length).toBe(5);
  });
});
