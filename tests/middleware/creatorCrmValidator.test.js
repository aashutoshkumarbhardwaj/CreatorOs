const {
  validateBrand,
  validateDeal,
  validateInvoice,
  validateMediaKit,
  validateCrmQuery,
} = require('../../middleware/validators/creatorCrmValidator');

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

describe('Creator CRM Validators', () => {
  describe('validateBrand', () => {
    it('should pass validation with valid brand data', async () => {
      const { req, res, next } = mockReqRes({
        method: 'POST',
        url: '/api/crm/brands',
        body: {
          companyName: 'Acme Corp',
          contactEmail: 'contact@acme.com',
          contactPhone: '+1 555-0199',
          website: 'https://acme.com',
          status: 'lead',
          notes: 'Potential sponsor',
        },
      });

      await validateBrand(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
    });

    it('should fail validation when companyName is missing', async () => {
      const { req, res, next } = mockReqRes({
        method: 'POST',
        url: '/api/crm/brands',
        body: {
          contactEmail: 'contact@acme.com',
        },
      });

      await validateBrand(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.some((e) => e.field === 'companyName')).toBe(true);
    });

    it('should fail validation when website has invalid protocol', async () => {
      const { req, res, next } = mockReqRes({
        method: 'POST',
        url: '/api/crm/brands',
        body: {
          companyName: 'Acme Corp',
          website: 'javascript:alert(1)',
        },
      });

      await validateBrand(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(422);
    });
  });

  describe('validateDeal', () => {
    it('should pass validation with valid deal data', async () => {
      const { req, res, next } = mockReqRes({
        method: 'POST',
        url: '/api/crm/deals',
        body: {
          dealName: 'Summer Sponsorship',
          amount: 5000,
          stage: 'negotiating',
        },
      });

      await validateDeal(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should fail validation when amount is negative', async () => {
      const { req, res, next } = mockReqRes({
        method: 'POST',
        url: '/api/crm/deals',
        body: {
          dealName: 'Summer Sponsorship',
          amount: -500,
        },
      });

      await validateDeal(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(422);
    });
  });

  describe('validateCrmQuery', () => {
    it('should strip object parameter injected into query (NoSQL query protection)', () => {
      const { req, res, next } = mockReqRes({
        method: 'GET',
        url: '/api/crm/data',
        query: {
          q: { $gt: '' },
          stage: 'lead',
        },
      });

      validateCrmQuery(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.query.q).toBeUndefined();
      expect(req.query.stage).toBe('lead');
    });
  });
});
