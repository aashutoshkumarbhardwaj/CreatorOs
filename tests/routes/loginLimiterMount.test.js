const fs = require('fs');
const path = require('path');

describe('login limiter mounting', () => {
    test('does not register a duplicate app-level POST /login limiter', () => {
        const source = fs.readFileSync(path.join(__dirname, '../../index.js'), 'utf8');

        expect(source).not.toMatch(/app\.post\(['"]\/login['"],\s*loginLimiter\)/);
    });

    test('keeps login rate limiting on the auth route', () => {
        const source = fs.readFileSync(path.join(__dirname, '../../routes/auth.js'), 'utf8');

        expect(source).toContain('router.post("/login", loginLimiter, loginValidator, login)');
    });
});
