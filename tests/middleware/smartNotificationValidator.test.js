const {
  validatePreferences,
  validateCreateNotification,
} = require('../../middleware/validators/smartNotificationValidator');

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

describe('Smart Notification Validators', () => {
  describe('validatePreferences', () => {
    it('should pass validation with valid preferences', async () => {
      const { req, res, next } = mockReqRes({
        method: 'PUT',
        url: '/api/notifications/preferences',
        body: {
          frequency: 'daily_digest',
          channels: {
            email: true,
            inApp: false,
          },
        },
      });

      await validatePreferences(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should fail when frequency is invalid', async () => {
      const { req, res, next } = mockReqRes({
        method: 'PUT',
        url: '/api/notifications/preferences',
        body: {
          frequency: 'invalid_frequency',
        },
      });

      await validatePreferences(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(422);
    });
  });

  describe('validateCreateNotification', () => {
    it('should pass with valid notification payload', async () => {
      const { req, res, next } = mockReqRes({
        method: 'POST',
        url: '/api/notifications',
        body: {
          title: 'New Deal Alert',
          message: 'You received a sponsorship offer!',
          priority: 'high',
          actionUrl: 'https://creatoros.io/crm',
        },
      });

      await validateCreateNotification(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should fail when title is missing', async () => {
      const { req, res, next } = mockReqRes({
        method: 'POST',
        url: '/api/notifications',
        body: {
          message: 'Missing title message',
        },
      });

      await validateCreateNotification(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(422);
    });
  });
});
