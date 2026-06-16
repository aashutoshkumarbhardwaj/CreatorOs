const services = require('../services.config');

/**
 * @function findServiceByKey
 * @description Automatically generated JSDoc for findServiceByKey
 * @returns {any}
 */
function findServiceByKey(key) {
    return services.find((service) => service.key === key);
}

/**
 * @function buildShortenerViewModel
 * @description Automatically generated JSDoc for buildShortenerViewModel
 * @returns {any}
 */
function buildShortenerViewModel(req, shortId = null, error = null) {
    return {
        service: findServiceByKey('url-shortener'),
        shortUrl: shortId ? `${req.protocol}://${req.get('host')}/u/${shortId}` : null,
        error,
    };
}

module.exports = {
    findServiceByKey,
    buildShortenerViewModel
};
