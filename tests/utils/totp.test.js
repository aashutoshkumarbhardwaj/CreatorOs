const { verifyTotp, generateHotp, decodeBase32 } = require('../../utils/totp');

describe('totp helpers', () => {
    // RFC 6238 appendix B style secret ("12345678901234567890" as base32).
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

    test('verifyTotp accepts the current window code', () => {
        const now = 1_111_111_111_000;
        const counter = Math.floor(now / 1000 / 30);
        const token = generateHotp(decodeBase32(secret), counter);

        expect(verifyTotp(secret, token, { now, window: 0 })).toBe(true);
    });

    test('verifyTotp rejects invalid tokens', () => {
        expect(verifyTotp(secret, '000000', { now: Date.now(), window: 0 })).toBe(false);
        expect(verifyTotp(secret, 'abc', { now: Date.now() })).toBe(false);
        expect(verifyTotp('', '123456')).toBe(false);
    });
});
