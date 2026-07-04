function cacheHeadersMiddleware(req, res, next) {
    const originalJson = res.json;
    const originalRender = res.render;

    res.setCacheStatus = function(status) {
        res.setHeader('X-Cache', status);
    };

    res.json = function(body) {
        if (!res.headersSent && !res.hasHeader('X-Cache')) {
            res.setHeader('X-Cache', 'MISS');
        }
        return originalJson.call(this, body);
    };

    res.render = function(view, locals, callback) {
        if (!res.headersSent && !res.hasHeader('X-Cache')) {
            res.setHeader('X-Cache', 'MISS');
        }
        return originalRender.call(this, view, locals, callback);
    };

    next();
}

module.exports = cacheHeadersMiddleware;
