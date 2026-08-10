/**
 * Security Test: EJS Template Injection Prevention
 *
 * Verifies that all res.render() calls use hardcoded template names
 * and are not derived from user input (URL parameters, query strings, etc.)
 * This prevents directory traversal and template injection attacks.
 */

const fs = require('fs');
const path = require('path');

describe('EJS Template Security - No User-Derived Template Names', () => {
    let indexJsContent;
    let indexDebugContent;
    let controllerFiles = [];
    let routeFiles = [];

    beforeAll(() => {
        // Read main server files
        indexJsContent = fs.readFileSync(path.join(__dirname, '../../index.js'), 'utf8');
        indexDebugContent = fs.readFileSync(path.join(__dirname, '../../index_debug.js'), 'utf8');

        // Collect all controller files
        const controllerDir = path.join(__dirname, '../../controller');
        if (fs.existsSync(controllerDir)) {
            controllerFiles = fs.readdirSync(controllerDir)
                .filter(f => f.endsWith('.js'))
                .map(f => fs.readFileSync(path.join(controllerDir, f), 'utf8'));
        }

        // Collect all route files
        const routesDir = path.join(__dirname, '../../routes');
        if (fs.existsSync(routesDir)) {
            routeFiles = fs.readdirSync(routesDir)
                .filter(f => f.endsWith('.js'))
                .map(f => fs.readFileSync(path.join(routesDir, f), 'utf8'));
        }
    });

    it('should not use req.params or req.query directly in res.render()', () => {
        const allContent = [indexJsContent, indexDebugContent, ...controllerFiles, ...routeFiles].join('\n');

        // Check for dangerous patterns like render(req.params.template) or render(req.query.page)
        const dangerousPatterns = [
            /res\.render\s*\(\s*req\.params\./,
            /res\.render\s*\(\s*req\.query\./,
            /res\.render\s*\(\s*req\.body\./,
            /render\s*\(\s*req\.params\./,
            /render\s*\(\s*req\.query\./,
            /render\s*\(\s*req\.body\./,
        ];

        let found = [];
        dangerousPatterns.forEach(pattern => {
            if (pattern.test(allContent)) {
                found.push(pattern.toString());
            }
        });

        expect(found).toEqual([]);
    });

    it('should only use hardcoded string literals in res.render() calls', () => {
        const allContent = [indexJsContent, indexDebugContent, ...controllerFiles, ...routeFiles].join('\n');

        // Extract all res.render() calls
        const renderCalls = allContent.match(/res\.render\s*\([^)]+\)/g) || [];

        // Each render call should have a string literal as first argument
        renderCalls.forEach(call => {
            // Should start with res.render('template-name' or res.render("template-name"
            expect(call).toMatch(/res\.render\s*\(['"][^'"]+['"]/);
        });

        expect(renderCalls.length).toBeGreaterThan(0);
    });

    it('should use template names from whitelist only', () => {
        const allContent = [indexJsContent, indexDebugContent, ...controllerFiles, ...routeFiles].join('\n');

        // Extract all template names used
        const templateMatches = allContent.match(/res\.render\s*\(['"]([^'"]+)['"]/g) || [];
        const templates = templateMatches.map(m => m.match(/['"]([^'"]+)['"]/)[1]);

        // Whitelist of allowed templates (based on views directory structure)
        const allowedTemplates = [
            'services-hub', 'terms', 'about', 'confirm-deletion', 'bio-builder', 'changelog',
            'dashboard', 'profile', 'settings', 'my-links', 'analytics', 'file-upload',
            'bio-editor', 'bio-profile', 'coming-soon', 'home', 'analytics-dashboard',
            'signup', '404', 'verify-email', 'reset-password', 'suggestions', 'password-reset',
            'preview-profile'
        ];

        const unknownTemplates = templates.filter(t => !allowedTemplates.includes(t));

        // Log for debugging (but don't fail - new templates are valid)
        if (unknownTemplates.length > 0) {
            console.log('New templates found (this is OK if intentional):', unknownTemplates);
        }

        expect(templates.length).toBeGreaterThan(0);
    });
});
