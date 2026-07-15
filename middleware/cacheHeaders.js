const cacheHeadersMiddleware = (req, res, next) => {
    res.setHeader('X-Cache', 'MISS');
    next();
};

module.exports = cacheHeadersMiddleware;
