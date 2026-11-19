const cacheHeadersMiddleware = (req, res, next) => {
    if (!res.hasHeader('X-Cache')) {
        res.setHeader('X-Cache', 'MISS');
    }

    next();
};

module.exports = cacheHeadersMiddleware;
