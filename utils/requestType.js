/**
 * @function wantsHtml
 * @description Determines if the incoming request expects an HTML response.
 * @returns {any}
 */
function wantsHtml(req) {
    const acceptHeader = req.get('Accept') || '';
    if (acceptHeader.includes('application/json') || req.xhr) {
        return false;
    }
    return req.accepts('html') !== false;
}

module.exports = { wantsHtml };