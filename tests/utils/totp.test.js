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

describe('verifyTotpStep', () => {
    const { verifyTotpStep } = require('../../utils/totp');
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
    const now = 1_111_111_111_000;
    const counter = Math.floor(now / 1000 / 30);
    const codeFor = (step) => generateHotp(decodeBase32(secret), step);

    test('returns the time-step the code belongs to', () => {
        expect(verifyTotpStep(secret, codeFor(counter), { now })).toBe(counter);
        expect(verifyTotpStep(secret, codeFor(counter - 1), { now })).toBe(counter - 1);
        expect(verifyTotpStep(secret, codeFor(counter + 1), { now })).toBe(counter + 1);
    });

    test('returns null outside the accepted window', () => {
        expect(verifyTotpStep(secret, codeFor(counter + 2), { now })).toBeNull();
        expect(verifyTotpStep(secret, codeFor(counter - 2), { now })).toBeNull();
        expect(verifyTotpStep(secret, codeFor(counter + 1), { now, window: 0 })).toBeNull();
    });

    test('returns null for malformed tokens and secrets', () => {
        expect(verifyTotpStep(secret, 'abc', { now })).toBeNull();
        expect(verifyTotpStep(secret, '12345', { now })).toBeNull();
        expect(verifyTotpStep('', codeFor(counter), { now })).toBeNull();
    });

    test('tolerates whitespace in the token', () => {
        const code = codeFor(counter);
        expect(verifyTotpStep(secret, `${code.slice(0, 3)} ${code.slice(3)}`, { now })).toBe(counter);
    });

    test('does not throw for times before the first time-step', () => {
        expect(verifyTotpStep(secret, '000000', { now: 0 })).toBeNull();
    });

    test('verifyTotp stays equivalent to verifyTotpStep', () => {
        expect(verifyTotp(secret, codeFor(counter), { now })).toBe(true);
        expect(verifyTotp(secret, codeFor(counter + 2), { now })).toBe(false);
    });
});

