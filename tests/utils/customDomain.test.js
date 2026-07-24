const { normalizeCustomDomain } = require('../../utils/customDomain');

describe('normalizeCustomDomain', () => {
    test('trims and lowercases hostnames', () => {
        expect(normalizeCustomDomain(' Example.COM ')).toBe('example.com');
    });

    test('removes a trailing root dot', () => {
        expect(normalizeCustomDomain('creator.example.com.')).toBe('creator.example.com');
    });

    test('rejects URL-shaped input', () => {
        expect(normalizeCustomDomain('https://example.com/path')).toBeNull();
        expect(normalizeCustomDomain('example.com/path')).toBeNull();
    });

    test('rejects empty and malformed domains', () => {
        expect(normalizeCustomDomain('   ')).toBeNull();
        expect(normalizeCustomDomain('localhost')).toBeNull();
        expect(normalizeCustomDomain('-example.com')).toBeNull();
    });
});
