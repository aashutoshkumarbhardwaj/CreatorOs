const {
    isValidTemplate,
    sanitizeTemplateName,
    validateTemplateParam
} = require('../../utils/templateSecurity');

describe('Template Security Utility', () => {
    const ALLOWED_TEMPLATES = new Set(['home', 'dashboard', 'profile', 'settings']);

    describe('isValidTemplate', () => {
        it('should allow valid template names from allowed list', () => {
            expect(isValidTemplate('home', ALLOWED_TEMPLATES)).toBe(true);
            expect(isValidTemplate('dashboard', ALLOWED_TEMPLATES)).toBe(true);
            expect(isValidTemplate('profile', ALLOWED_TEMPLATES)).toBe(true);
        });

        it('should reject templates not in allowed list', () => {
            expect(isValidTemplate('admin', ALLOWED_TEMPLATES)).toBe(false);
            expect(isValidTemplate('secret', ALLOWED_TEMPLATES)).toBe(false);
        });

        it('should reject path traversal attempts', () => {
            expect(isValidTemplate('../../../etc/passwd', ALLOWED_TEMPLATES)).toBe(false);
            expect(isValidTemplate('..\\..\\..\\windows\\system32', ALLOWED_TEMPLATES)).toBe(false);
            expect(isValidTemplate('../../admin', ALLOWED_TEMPLATES)).toBe(false);
        });

        it('should reject absolute paths', () => {
            expect(isValidTemplate('/etc/passwd', ALLOWED_TEMPLATES)).toBe(false);
            expect(isValidTemplate('C:\\windows\\system32', ALLOWED_TEMPLATES)).toBe(false);
            expect(isValidTemplate('~/secret', ALLOWED_TEMPLATES)).toBe(false);
        });

        it('should reject paths with slashes or backslashes', () => {
            expect(isValidTemplate('pages/home', ALLOWED_TEMPLATES)).toBe(false);
            expect(isValidTemplate('views\\dashboard', ALLOWED_TEMPLATES)).toBe(false);
        });

        it('should reject templates with special characters', () => {
            expect(isValidTemplate('home<script>', ALLOWED_TEMPLATES)).toBe(false);
            expect(isValidTemplate('dashboard; rm -rf /', ALLOWED_TEMPLATES)).toBe(false);
            expect(isValidTemplate('profile|admin', ALLOWED_TEMPLATES)).toBe(false);
        });

        it('should reject non-string inputs', () => {
            expect(isValidTemplate(null, ALLOWED_TEMPLATES)).toBe(false);
            expect(isValidTemplate(undefined, ALLOWED_TEMPLATES)).toBe(false);
            expect(isValidTemplate(123, ALLOWED_TEMPLATES)).toBe(false);
            expect(isValidTemplate({}, ALLOWED_TEMPLATES)).toBe(false);
        });

        it('should handle whitespace', () => {
            expect(isValidTemplate('  home  ', ALLOWED_TEMPLATES)).toBe(true);
            expect(isValidTemplate(' dashboard ', ALLOWED_TEMPLATES)).toBe(true);
        });

        it('should work with array instead of Set', () => {
            const allowedArray = ['home', 'dashboard', 'profile'];
            expect(isValidTemplate('home', allowedArray)).toBe(true);
            expect(isValidTemplate('admin', allowedArray)).toBe(false);
        });

        it('should reject templates with dots (except in allowed names)', () => {
            expect(isValidTemplate('home.js', ALLOWED_TEMPLATES)).toBe(false);
            expect(isValidTemplate('.env', ALLOWED_TEMPLATES)).toBe(false);
        });
    });

    describe('sanitizeTemplateName', () => {
        it('should remove path traversal patterns', () => {
            expect(sanitizeTemplateName('../../../etc/passwd')).toBe('etcpasswd');
            expect(sanitizeTemplateName('..\\..\\..\\windows')).toBe('windows');
        });

        it('should remove path separators', () => {
            expect(sanitizeTemplateName('pages/home')).toBe('pageshome');
            expect(sanitizeTemplateName('views\\dashboard')).toBe('viewsdashboard');
        });

        it('should keep alphanumeric, hyphens, and underscores', () => {
            expect(sanitizeTemplateName('home-page_v2')).toBe('home-page_v2');
            expect(sanitizeTemplateName('admin_dashboard')).toBe('admin_dashboard');
        });

        it('should handle non-string inputs', () => {
            expect(sanitizeTemplateName(null)).toBe('');
            expect(sanitizeTemplateName(undefined)).toBe('');
            expect(sanitizeTemplateName(123)).toBe('');
        });

        it('should trim whitespace', () => {
            expect(sanitizeTemplateName('  home  ')).toBe('home');
        });
    });

    describe('validateTemplateParam middleware', () => {
        it('should call next() for valid template', () => {
            const middleware = validateTemplateParam(ALLOWED_TEMPLATES, 'page');
            const req = { params: { page: 'home' } };
            const res = { status: jest.fn().returnThis(), render: jest.fn() };
            const next = jest.fn();

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.render).not.toHaveBeenCalled();
        });

        it('should render 404 for invalid template', () => {
            const middleware = validateTemplateParam(ALLOWED_TEMPLATES, 'page');
            const req = { params: { page: '../../../etc/passwd' } };
            const res = { status: jest.fn().returnThis(), render: jest.fn() };
            const next = jest.fn();

            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.render).toHaveBeenCalledWith('404', expect.any(Object));
            expect(next).not.toHaveBeenCalled();
        });

        it('should use custom parameter name', () => {
            const middleware = validateTemplateParam(ALLOWED_TEMPLATES, 'name');
            const req = { params: { name: 'home' } };
            const res = { status: jest.fn().returnThis(), render: jest.fn() };
            const next = jest.fn();

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });
    });
});
