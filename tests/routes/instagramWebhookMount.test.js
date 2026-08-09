const fs = require('fs');
const path = require('path');

describe('instagram webhook mount order', () => {
    test('mounts the Meta webhook before the global CSRF middleware', () => {
        const indexSource = fs.readFileSync(path.join(__dirname, '../../index.js'), 'utf8');

        const webhookMountIndex = indexSource.indexOf('"/api/instagram/webhook"');
        const csrfIndex = indexSource.indexOf('app.use(verifyCsrf)');

        expect(webhookMountIndex).toBeGreaterThan(-1);
        expect(csrfIndex).toBeGreaterThan(-1);
        expect(webhookMountIndex).toBeLessThan(csrfIndex);
    });

    test('does not remount the webhook inside the instagram router', () => {
        const routeSource = fs.readFileSync(path.join(__dirname, '../../routes/instagram.js'), 'utf8');

        expect(routeSource).not.toContain('router.post("/webhook"');
        expect(routeSource).not.toContain('verifyWebhookSignature');
    });
});
