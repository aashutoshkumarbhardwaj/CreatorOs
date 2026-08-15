const {
  validateBioLink,
  validateProfile,
} = require('../../middleware/validators/creatorBioValidator');

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

describe('Creator Bio Validators', () => {
  describe('validateBioLink', () => {
    it('should pass with valid http/https bio link', async () => {
      const { req, res, next } = mockReqRes({
        method: 'POST',
        url: '/api/bio/links',
        body: {
          url: 'https://mywebsite.com',
          title: 'My Portfolio',
        },
      });

      await validateBioLink(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should reject javascript: protocol URI', async () => {
      const { req, res, next } = mockReqRes({
        method: 'POST',
        url: '/api/bio/links',
        body: {
          url: 'javascript:alert(document.cookie)',
          title: 'Malicious Link',
        },
      });

      await validateBioLink(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('should escape HTML in link title', async () => {
      const { req, res, next } = mockReqRes({
        method: 'POST',
        url: '/api/bio/links',
        body: {
          url: 'https://mywebsite.com',
          title: '<script>alert(1)</script>',
        },
      });

      await validateBioLink(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body.title).not.toContain('<script>');
    });
  });

  describe('validateProfile', () => {
    it('should pass with valid profile updates', async () => {
      const { req, res, next } = mockReqRes({
        method: 'PUT',
        url: '/api/settings/profile',
        body: {
          name: 'Jane Creator',
          alias: 'jane_creator',
          bio: 'Digital content creator.',
        },
      });

      await validateProfile(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });
});
