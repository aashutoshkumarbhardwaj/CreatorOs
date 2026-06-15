const crypto = require('crypto');

/**
 * Middleware to generate a CSRF token and set it as an HttpOnly cookie.
 * It also exposes the token to views via res.locals.csrfToken.
 */
function generateCsrf(req, res, next) {
    let token = req.cookies._csrf;

    if (!token) {
        token = crypto.randomBytes(32).toString('hex');
        res.cookie('_csrf', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });
    }

    // Always expose to views
    res.locals.csrfToken = token;
    next();
}

/**
 * Middleware to verify the CSRF token on state-changing requests.
 */
function verifyCsrf(req, res, next) {
    const safeMethods = ['GET', 'HEAD', 'OPTIONS', 'TRACE'];
    
    if (safeMethods.includes(req.method)) {
        return next();
    }

    const cookieToken = req.cookies._csrf;
    const requestToken = 
        (req.body && req.body._csrf) || 
        req.headers['x-csrf-token'] || 
        req.headers['x-xsrf-token'];

    if (!cookieToken || !requestToken || cookieToken !== requestToken) {
        return res.status(403).json({
            success: false,
            message: 'Invalid CSRF token. Request blocked.',
            error: 'CSRF token mismatch'
        });
    }

    next();
}

module.exports = {
    generateCsrf,
    verifyCsrf
};
