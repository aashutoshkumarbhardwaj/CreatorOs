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
    it('should pass validation with schema-compatible preferences', async () => {
      const { req, res, next } = mockReqRes({
        method: 'PUT',
        url: '/api/notifications/preferences',
        body: {
          channels: {
            email: true,
            sms: false,
            inApp: false,
            push: true,
          },
          categories: {
            system: true,
            engagement: true,
            content: false,
            analytics: true,
            marketing: false,
          },
          quietHours: {
            enabled: true,
            startTime: '22:00',
            endTime: '08:00',
            timezone: 'UTC',
          },
          intelligentScheduling: {
            enabled: true,
            preferredWindow: 'morning',
          },
          deduplication: {
            enabled: true,
            windowMinutes: 30,
          },
        },
      });

      await validatePreferences(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should fail when a channel setting is not boolean', async () => {
      const { req, res, next } = mockReqRes({
        method: 'PUT',
        url: '/api/notifications/preferences',
        body: {
          channels: {
            sms: 'false',
          },
        },
      });

      await validatePreferences(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(422);
    });

    it('should fail when categories is not an object', async () => {
      const { req, res, next } = mockReqRes({
        method: 'PUT',
        url: '/api/notifications/preferences',
        body: {
          categories: ['system', 'content'],
        },
      });

      await validatePreferences(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(422);
    });

    it('should fail when a category setting is not boolean', async () => {
      const { req, res, next } = mockReqRes({
        method: 'PUT',
        url: '/api/notifications/preferences',
        body: {
          categories: {
            marketing: 'false',
          },
        },
      });

      await validatePreferences(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(422);
    });

    it('should fail when quiet hours use an invalid time', async () => {
      const { req, res, next } = mockReqRes({
        method: 'PUT',
        url: '/api/notifications/preferences',
        body: {
          quietHours: {
            startTime: '25:00',
          },
        },
      });

      await validatePreferences(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(422);
    });

    it('should fail when preferred window is outside the schema enum', async () => {
      const { req, res, next } = mockReqRes({
        method: 'PUT',
        url: '/api/notifications/preferences',
        body: {
          intelligentScheduling: {
            preferredWindow: 'night',
          },
        },
      });

      await validatePreferences(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(422);
    });

    it('should fail when deduplication window is outside the schema range', async () => {
      const { req, res, next } = mockReqRes({
        method: 'PUT',
        url: '/api/notifications/preferences',
        body: {
          deduplication: {
            windowMinutes: 1441,
          },
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
