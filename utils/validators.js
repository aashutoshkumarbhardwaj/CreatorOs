/**
 * @function isValidUrl
 * @description Validates whether a given string is a properly formatted HTTP/HTTPS URL.
 * @returns {boolean} True if the string is a valid HTTP/HTTPS URL, false otherwise.
 */
function isValidUrl(string) {
    if (typeof string !== 'string') return false;
    try {
        const url = new URL(string.trim());
        // Only allow http and https protocols to prevent Open Redirects to javascript:, data:, etc.
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}

module.exports = {
    isValidUrl,
};
