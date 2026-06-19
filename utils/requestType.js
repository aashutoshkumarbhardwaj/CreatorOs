/**
 * @function wantsHtml
 * @description Determines if the incoming request expects an HTML response.
 * @returns {any}
 */
function wantsHtml(req) {
    return req.accepts('html') !== false;
}

module.exports = { wantsHtml };