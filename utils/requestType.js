/**
 * @function wantsHtml
 * @description Determines if the incoming request expects an HTML response.
 * @returns {any}
 */
function wantsHtml(req) {
    if (!req || typeof req.accepts !== 'function') return false;
    return req.accepts('html') !== false;
}

module.exports = { wantsHtml };