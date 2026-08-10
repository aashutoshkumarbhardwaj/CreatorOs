const fs = require('fs');
const path = require('path');

describe('CSP nonce Helmet ordering', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');

    test('generates nonce before Helmet and uses Helmet CSP directives', () => {
        const nonceIdx = source.indexOf('res.locals.nonce = crypto.randomBytes');
        const helmetIdx = source.indexOf('helmet({');
        const cspFalseIdx = source.indexOf('contentSecurityPolicy: false');
        const manualCspIdx = source.indexOf("res.setHeader(\n    \"Content-Security-Policy\"");

        expect(nonceIdx).toBeGreaterThan(-1);
        expect(helmetIdx).toBeGreaterThan(-1);
        expect(nonceIdx).toBeLessThan(helmetIdx);
        expect(cspFalseIdx).toBe(-1);
        expect(manualCspIdx).toBe(-1);
        expect(source).toContain("(req, res) => `'nonce-${res.locals.nonce}'`");
    });
});
