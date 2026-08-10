function parseFiniteNumber(value) {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function parseVisitCoordinates(query = {}) {
    const x = parseFiniteNumber(query.x);
    const y = parseFiniteNumber(query.y);

    if (x === null || y === null) {
        return null;
    }

    return { x, y };
}

module.exports = {
    parseVisitCoordinates,
};
