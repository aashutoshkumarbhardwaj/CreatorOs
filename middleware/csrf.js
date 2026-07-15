const crypto = require('crypto');

/**
 * Middleware to generate a CSRF token and set it as a secure HttpOnly cookie.
 * Protects against Cross-Site Request Forgery by requiring token validation on state changes.
 * It also exposes the token to views via res.locals.csrfToken.
 */
function generateCsrf(req, res, next) {
    let token = req.cookies._csrf;

    if (!token) {
        token = crypto.randomBytes(32).toString('hex');
        const isProduction = process.env.NODE_ENV === 'production';
        const isSecureEnvironment = isProduction || process.env.COOKIE_SECURE_DEV === 'true';

        res.cookie('_csrf', token, {
            httpOnly: true, // Prevents JavaScript access, protecting against XSS-based CSRF
            secure: isSecureEnvironment, // HTTPS-only in production
            sameSite: 'strict', // Strict same-site policy prevents cross-origin CSRF attacks
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            path: '/', // Explicitly set path for clarity
            signed: false // Not signed since we're using SameSite protection
        });
    }

    // Always expose to views for form submissions
    res.locals.csrfToken = token;
    next();
}

/**
 * Middleware to verify the CSRF token on state-changing requests (POST, PUT, DELETE, PATCH).
 * Validates that the request includes a valid CSRF token matching the one in the secure cookie.
 * Blocks requests with missing or mismatched tokens with a 403 Forbidden response.
 */
function verifyCsrf(req, res, next) {
    const safeMethods = ['GET', 'HEAD', 'OPTIONS', 'TRACE'];

    // Skip verification for safe HTTP methods
    if (safeMethods.includes(req.method)) {
        return next();
    }

    // Extract CSRF token from multiple sources (form body, headers)
    // This allows both HTML forms and AJAX requests to submit valid tokens
    const cookieToken = req.cookies._csrf;
    const requestToken =
        (req.body && req.body._csrf) ||
        req.headers['x-csrf-token'] ||
        req.headers['x-xsrf-token'];

    // Validate token presence and match
    if (!cookieToken || !requestToken || cookieToken !== requestToken) {
        const errorMsg = 'Invalid CSRF token. Request blocked.';

        // Return appropriate response format based on request type
        if (req.accepts('json')) {
            return res.status(403).json({
                success: false,
                message: errorMsg,
                error: 'CSRF token mismatch'
            });
        }

        // For form submissions, redirect with error
        return res.status(403).redirect(`${req.originalUrl}?csrf_error=true`);
    }

    next();
}

module.exports = {
    generateCsrf,
    verifyCsrf
};
