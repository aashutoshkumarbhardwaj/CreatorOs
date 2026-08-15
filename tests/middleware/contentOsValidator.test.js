const {
  validateContentItem,
  validateContentFolder,
  validateAiPrompt,
} = require('../../middleware/validators/contentOsValidator');

function mockReqRes(options = {}) {
  const req = {
    method: options.method || 'POST',
    url: options.url || '/',
    headers: { accept: 'application/json', ...(options.headers || {}) },
    body: options.body || {},
    query: options.query || {},
    params: options.params || {},
    get(headerName) {
      const lower = headerName.toLowerCase();
      return this.headers[lower] || this.headers[headerName] || '';
    },
    accepts(type) {
      const accept = this.get('Accept') || '';
      return accept.includes(type);
    },
  };
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    render(view, locals) {
      this.renderedView = view;
      this.renderedLocals = locals;
      return this;
    },
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('Content OS Validators', () => {
  describe('validateContentItem', () => {
    it('should pass with valid content item', async () => {
      const { req, res, next } = mockReqRes({
        method: 'POST',
        url: '/api/content/items',
        body: {
          title: '10 Productivity Tips for Creators',
          type: 'script',
          status: 'scripting',
          platform: 'youtube',
          priority: 'high',
        },
      });

      await validateContentItem(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should fail with missing title', async () => {
      const { req, res, next } = mockReqRes({
        method: 'POST',
        url: '/api/content/items',
        body: {
          type: 'script',
        },
      });

      await validateContentItem(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(422);
    });
  });

  describe('validateContentFolder', () => {
    it('should pass with valid folder data', async () => {
      const { req, res, next } = mockReqRes({
        method: 'POST',
        url: '/api/content/folders',
        body: {
          name: 'Q3 Campaigns',
          color: '#FF5733',
        },
      });

      await validateContentFolder(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should fail with invalid hex color', async () => {
      const { req, res, next } = mockReqRes({
        method: 'POST',
        url: '/api/content/folders',
        body: {
          name: 'Q3 Campaigns',
          color: 'red-not-hex',
        },
      });

      await validateContentFolder(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(422);
    });
  });

  describe('validateAiPrompt', () => {
    it('should pass with valid AI prompt', async () => {
      const { req, res, next } = mockReqRes({
        method: 'POST',
        url: '/api/content/ai/generate',
        body: {
          prompt: 'Generate viral hook for tech video',
          mode: 'hook',
          platform: 'tiktok',
        },
      });

      await validateAiPrompt(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });
});
