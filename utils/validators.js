/**
 * @function isValidUrl
 * @description Automatically generated JSDoc for isValidUrl
 * @returns {any}
 */
function isValidUrl(string) {
    try {
        const url = new URL(string);
        // Only allow http and https protocols to prevent Open Redirects to javascript:, data:, etc.
        return url.protocol === "http:" || url.protocol === "https:";
    } catch (err) {
        return false;
    }
}

module.exports = {
    isValidUrl,
};
