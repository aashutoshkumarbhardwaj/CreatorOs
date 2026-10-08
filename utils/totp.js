const crypto = require('crypto');

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function decodeBase32(secret) {
    const cleaned = String(secret || '')
        .toUpperCase()
        .replace(/=+$/g, '')
        .replace(/[^A-Z2-7]/g, '');

    let bits = '';
    for (const char of cleaned) {
        const value = BASE32_ALPHABET.indexOf(char);
        if (value < 0) continue;
        bits += value.toString(2).padStart(5, '0');
    }

    const bytes = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
        bytes.push(parseInt(bits.slice(i, i + 8), 2));
    }
    return Buffer.from(bytes);
}

function generateHotp(secretBuffer, counter) {
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigUInt64BE(BigInt(counter));

    const hmac = crypto.createHmac('sha1', secretBuffer).update(counterBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0xf;
    const code =
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);

    return String(code % 10 ** 6).padStart(6, '0');
}

/**
 * Find the TOTP time-step a token was generated for.
 *
 * Every step in the accepted window is compared (in constant time, without
 * returning early) so timing does not reveal whether, or in which step, a guess
 * matched. Callers that must enforce single use (RFC 6238 section 5.2) store the
 * returned step and reject anything at or below it - see utils/twoFactor.js.
 *
 * @param {string} secret - Base32 TOTP secret
 * @param {string|number} token - User-provided OTP
 * @param {{ window?: number, step?: number, now?: number }} [options]
 * @returns {number|null} The matching time-step counter, or null when the token is invalid.
 */
function verifyTotpStep(secret, token, options = {}) {
    const window = options.window ?? 1;
    const step = options.step ?? 30;
    const now = options.now ?? Date.now();
    const provided = String(token || '').replace(/\s+/g, '');

    if (!/^\d{6}$/.test(provided)) {
        return null;
    }

    const secretBuffer = decodeBase32(secret);
    if (!secretBuffer.length) {
        return null;
    }

    const providedBuffer = Buffer.from(provided);
    const counter = Math.floor(now / 1000 / step);
    let matchedStep = null;

    for (let offset = -window; offset <= window; offset += 1) {
        const candidateStep = counter + offset;
        if (candidateStep < 0) continue;

        const candidate = Buffer.from(generateHotp(secretBuffer, candidateStep));
        if (crypto.timingSafeEqual(candidate, providedBuffer) && matchedStep === null) {
            matchedStep = candidateStep;
        }
    }

    return matchedStep;
}

/**
 * Verify a TOTP token against a base32-encoded shared secret.
 * Stateless: it does not stop the same code being accepted again within its
 * window. Use consumeTotp() from utils/twoFactor.js wherever a code authorises
 * something.
 * @param {string} secret - Base32 TOTP secret
 * @param {string|number} token - User-provided OTP
 * @param {{ window?: number, step?: number, now?: number }} [options]
 * @returns {boolean}
 */
function verifyTotp(secret, token, options = {}) {
    return verifyTotpStep(secret, token, options) !== null;
}

module.exports = {
    verifyTotp,
    verifyTotpStep,
    generateHotp,
    decodeBase32,
};
