/**
 * Template Security Utility
 * Prevents path traversal and template injection attacks
 *
 * Issue #786: Dynamic EJS template name derived from URL parameter enables local file inclusion
 */

/**
 * Validates that a template name is safe and allowed
 * @param {string} templateName - The template name/path to validate
 * @param {Set<string>|Array<string>} allowedTemplates - Set or array of allowed template names
 * @returns {boolean} - True if template is allowed and safe
 *
 * Security checks:
 * - No path traversal patterns (../, ..\, etc.)
 * - No absolute paths
 * - Only alphanumeric, hyphens, and underscores allowed
 * - Must be in the allowedTemplates list
 */
function isValidTemplate(templateName, allowedTemplates) {
    // Convert array to Set for consistent handling
    const allowed = allowedTemplates instanceof Set ? allowedTemplates : new Set(allowedTemplates);

    // Reject if not a string
    if (typeof templateName !== 'string') {
        return false;
    }

    const normalized = templateName.trim();

    // Check for path traversal patterns
    if (normalized.includes('..') ||
        normalized.includes('/') ||
        normalized.includes('\\') ||
        normalized.includes('~')) {
        return false;
    }

    // Check for absolute paths
    if (normalized.startsWith('/') || normalized.match(/^[a-zA-Z]:/)) {
        return false;
    }

    // Only allow alphanumeric, hyphens, and underscores
    if (!/^[a-zA-Z0-9_-]+$/.test(normalized)) {
        return false;
    }

    // Must be in the allowed list
    return allowed.has(normalized);
}

/**
 * Safe template renderer
 * Validates template name before rendering
 *
 * @param {Object} res - Express response object
 * @param {string} templateName - The template name to render
 * @param {Set<string>|Array<string>} allowedTemplates - Allowed templates
 * @param {Object} data - Template data
 * @param {number} notFoundStatus - HTTP status for not found (default: 404)
 * @returns {void}
 *
 * Usage:
 * const ALLOWED_PAGES = new Set(['home', 'dashboard', 'profile', 'settings']);
 * safeRender(res, req.params.page, ALLOWED_PAGES, { user: userData });
 */
function safeRender(res, templateName, allowedTemplates, data = {}, notFoundStatus = 404) {
    if (!isValidTemplate(templateName, allowedTemplates)) {
        return res.status(notFoundStatus).render('404', {
            message: 'Page not found'
        });
    }

    return res.render(templateName, data);
}

/**
 * Middleware factory to protect routes from template injection
 *
 * @param {Set<string>|Array<string>} allowedTemplates - Allowed template names
 * @param {string} paramName - URL parameter name (default: 'page')
 * @returns {Function} - Express middleware function
 *
 * Usage:
 * const ALLOWED_PAGES = new Set(['home', 'dashboard', 'profile']);
 * app.get('/page/:name', validateTemplateParam(ALLOWED_PAGES, 'name'), (req, res) => {
 *     res.render(req.params.name);
 * });
 */
function validateTemplateParam(allowedTemplates, paramName = 'page') {
    return (req, res, next) => {
        const templateName = req.params[paramName];

        if (!isValidTemplate(templateName, allowedTemplates)) {
            return res.status(404).render('404', {
                message: 'Page not found'
            });
        }

        next();
    };
}

/**
 * Sanitize template name for safer usage
 * Removes any potentially dangerous characters
 * Note: This should be combined with whitelisting, not used alone
 *
 * @param {string} templateName - The template name to sanitize
 * @returns {string} - Sanitized template name
 */
function sanitizeTemplateName(templateName) {
    if (typeof templateName !== 'string') {
        return '';
    }

    return templateName
        .trim()
        .replace(/\.\./g, '')           // Remove ..
        .replace(/[\/\\]/g, '')         // Remove path separators
        .replace(/[^a-zA-Z0-9_-]/g, ''); // Keep only safe characters
}

module.exports = {
    isValidTemplate,
    safeRender,
    validateTemplateParam,
    sanitizeTemplateName
};
