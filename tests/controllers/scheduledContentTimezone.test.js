const { isValidTimeZone } = require('../../controller/contentController');

describe('isValidTimeZone', () => {
    test('accepts valid IANA timezone names', () => {
        expect(isValidTimeZone('UTC')).toBe(true);
        expect(isValidTimeZone('Asia/Kolkata')).toBe(true);
    });

    test('rejects invalid timezone names', () => {
        expect(isValidTimeZone('Mars/Base')).toBe(false);
        expect(isValidTimeZone('')).toBe(false);
        expect(isValidTimeZone(null)).toBe(false);
    });
});
