/**
 * Security Test: Session Management Architecture
 *
 * Verifies that the application uses JWT tokens for session management
 * instead of Express MemoryStore, preventing unbounded memory growth
 * and enabling horizontal scaling.
 */

const fs = require('fs');
const path = require('path');

describe('Session Management Security - JWT Configuration', () => {
    let indexJsContent;
    let authControllerContent;
    let packageJsonContent;

    beforeAll(() => {
        indexJsContent = fs.readFileSync(path.join(__dirname, '../../index.js'), 'utf8');
        authControllerContent = fs.readFileSync(path.join(__dirname, '../../controller/auth.js'), 'utf8');
        packageJsonContent = fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8');
    });

    it('should NOT use express-session with MemoryStore', () => {
        // Check that the dangerous pattern is not present
        expect(indexJsContent).not.toMatch(/require\s*\(\s*['"]*express-session['"]*\s*\)/);
        expect(indexJsContent).not.toMatch(/MemoryStore/);
        expect(indexJsContent).not.toMatch(/session\s*\(\s*{/);
    });

    it('should use jsonwebtoken for session management', () => {
        // JWT should be imported and used for token generation
        expect(indexJsContent).toMatch(/jwt/i);
        expect(authControllerContent).toMatch(/jwt\.sign/);
        expect(packageJsonContent).toContain('jsonwebtoken');
    });

    it('should sign JWT tokens with a secret key', () => {
        // Tokens must be signed for integrity verification
        expect(authControllerContent).toMatch(/jwt\.sign\s*\([^)]*process\.env\.JWT_SECRET/);
    });

    it('should use HTTP-only cookies for token storage', () => {
        // Cookies should be marked as HTTP-only to prevent XSS access
        expect(authControllerContent).toMatch(/httpOnly\s*:\s*true/);
    });

    it('should set secure cookie flag for production', () => {
        // Production cookies should only transmit over HTTPS
        const cookieConfig = authControllerContent.match(/res\.cookie\([^}]+}\s*\)/s);
        if (cookieConfig) {
            expect(cookieConfig[0]).toMatch(/secure\s*:/);
        }
    });

    it('should set SameSite policy on cookies', () => {
        // CSRF protection via SameSite cookie policy (lax allows OAuth redirects)
        expect(authControllerContent).toMatch(/sameSite\s*:\s*['"]lax['"]/);
    });

    it('should validate JWT tokens on protected routes', () => {
        // Check for token verification in auth middleware
        const authDir = path.join(__dirname, '../../middleware');
        if (fs.existsSync(authDir)) {
            const middlewareFiles = fs.readdirSync(authDir)
                .filter(f => f.endsWith('.js'))
                .map(f => fs.readFileSync(path.join(authDir, f), 'utf8'));

            const hasVerification = middlewareFiles.some(content =>
                content.includes('jwtVerify') || content.includes('jwt.verify')
            );

            expect(hasVerification).toBe(true);
        }
    });

    it('should NOT store sessions server-side in memory', () => {
        // Verify no in-memory session store accumulation
        expect(indexJsContent).not.toMatch(/sessions\s*:\s*{}/);
        expect(indexJsContent).not.toMatch(/sessionStore\s*=/);
        expect(indexJsContent).not.toMatch(/sessions\s*=\s*new\s*Map/);
    });

    it('should include JWT_SECRET in required environment variables', () => {
        // Secret key is critical for token signing
        expect(indexJsContent).toMatch(/JWT_SECRET/);
    });
});
