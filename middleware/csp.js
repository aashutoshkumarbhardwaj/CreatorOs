const crypto = require('crypto');

// Generates a fresh per-request nonce and sets a nonce-based CSP header.
// 'unsafe-inline'/'unsafe-eval' let any injected <script> tag run, which
// defeats the purpose of CSP as an XSS mitigation. A per-request nonce lets
// legitimate inline scripts (marked with the matching nonce attribute) run
// while blocking anything an attacker injects, since they can't predict it.
function csp(req, res, next) {
    res.locals.nonce = crypto.randomBytes(16).toString('base64');

    res.setHeader(
        'Content-Security-Policy',
        [
            "default-src 'self'",
            `script-src 'self' 'nonce-${res.locals.nonce}' https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com`,
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: https:",
            "connect-src 'self' https:",
            "frame-ancestors 'none'",
            "object-src 'none'",
        ].join('; ')
    );

    next();
}

module.exports = csp;
