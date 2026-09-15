const {
  validateEventType,
  validateCreateBooking,
} = require('../../middleware/validators/meetingValidator');

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

describe('Meeting Validators', () => {
  describe('validateEventType', () => {
    it('should pass with valid event type', async () => {
      const { req, res, next } = mockReqRes({
        method: 'POST',
        url: '/api/meetings/event-types',
        body: {
          title: '30 Min Discovery Call',
          slug: '30-min-discovery',
          duration: 30,
          price: 50,
        },
      });

      await validateEventType(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should fail with negative price', async () => {
      const { req, res, next } = mockReqRes({
        method: 'POST',
        url: '/api/meetings/event-types',
        body: {
          title: 'Consultation',
          price: -10,
        },
      });

      await validateEventType(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(422);
    });
  });

  describe('validateCreateBooking', () => {
    it('should pass with the payload emitted by the public booking page', async () => {
      const { req, res, next } = mockReqRes({
        method: 'POST',
        url: '/api/public/meetings/alex/30-min-book/book',
        body: {
          attendeeName: 'Jane Doe',
          attendeeEmail: 'jane@example.com',
          attendeeNotes: 'Looking forward to the call.',
          startTime: new Date().toISOString(),
          timeZone: 'Asia/Kolkata',
        },
      });

      await validateCreateBooking(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should fail with invalid email', async () => {
      const { req, res, next } = mockReqRes({
        method: 'POST',
        url: '/api/public/meetings/alex/30-min-book/book',
        body: {
          attendeeName: 'Jane Doe',
          attendeeEmail: 'not-an-email',
          startTime: new Date().toISOString(),
        },
      });

      await validateCreateBooking(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(422);
    });

    it('should fail when attendee name is missing', async () => {
      const { req, res, next } = mockReqRes({
        method: 'POST',
        url: '/api/public/meetings/alex/30-min-book/book',
        body: {
          attendeeEmail: 'jane@example.com',
          startTime: new Date().toISOString(),
        },
      });

      await validateCreateBooking(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(422);
      expect(res.body.errors.some((error) => error.field === 'attendeeName')).toBe(true);
    });

    it('should fail when start time is missing', async () => {
      const { req, res, next } = mockReqRes({
        method: 'POST',
        url: '/api/public/meetings/alex/30-min-book/book',
        body: {
          attendeeName: 'Jane Doe',
          attendeeEmail: 'jane@example.com',
        },
      });

      await validateCreateBooking(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(422);
      expect(res.body.errors.some((error) => error.field === 'startTime')).toBe(true);
    });
  });
});
