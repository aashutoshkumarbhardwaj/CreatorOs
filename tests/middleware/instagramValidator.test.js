const { validateDmTrigger } = require('../../middleware/validators/instagramValidator');

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

describe('Instagram DM Trigger Validator', () => {
  it('should pass with valid trigger payload', async () => {
    const { req, res, next } = mockReqRes({
      method: 'POST',
      url: '/api/instagram/triggers',
      body: {
        keyword: 'PRICE',
        responseType: 'text',
        responseText: 'Check out our pricing page!',
        isActive: true,
      },
    });

    await validateDmTrigger(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should fail when keyword or responseText is missing', async () => {
    const { req, res, next } = mockReqRes({
      method: 'POST',
      url: '/api/instagram/triggers',
      body: {
        keyword: '',
        responseText: '',
      },
    });

    await validateDmTrigger(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(422);
  });
});
