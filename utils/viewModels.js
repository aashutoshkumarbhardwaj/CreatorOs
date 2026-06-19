const services = require('../services.config');

/**
 * @function findServiceByKey
 * @description Locates a service configuration by its unique key.
 * @returns {any}
 */
function findServiceByKey(key) {
    return services.find((service) => service.key === key);
}

/**
 * @function buildShortenerViewModel
 * @description Constructs the view model for the URL shortener interface.
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
