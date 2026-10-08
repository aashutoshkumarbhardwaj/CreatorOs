const { verifyTotpStep } = require("./totp");

/**
 * Verify a TOTP code AND burn it, so the same code cannot be used twice.
 *
 * RFC 6238 section 5.2: "the verifier MUST NOT accept the second attempt of the
 * OTP after the successful validation has been issued for the first OTP". A plain
 * verifyTotp() accepts a code for the whole +/-1 step window (about 90 seconds),
 * so a code that was phished, shoulder-surfed or intercepted can be replayed.
 *
 * The accepted time-step is recorded with one conditional update that only
 * matches while the stored step is lower, so of any number of concurrent
 * requests carrying the same code exactly one can succeed.
 *
 * @param {object} User - the User model
 * @param {{ _id: any, twoFactorSecret?: string }} user - user document with twoFactorSecret loaded
 * @param {string|number} token - the code the user typed
 * @param {{ window?: number, step?: number, now?: number }} [options]
 * @returns {Promise<boolean>} true only for a valid code that has not been used before
 */
async function consumeTotp(User, user, token, options = {}) {
    if (!user || !user.twoFactorSecret) {
        return false;
    }

    const step = verifyTotpStep(user.twoFactorSecret, token, options);
    if (step === null) {
        return false;
    }

    const result = await User.updateOne(
        {
            _id: user._id,
            $or: [{ twoFactorLastUsedStep: null }, { twoFactorLastUsedStep: { $lt: step } }],
        },
        { $set: { twoFactorLastUsedStep: step } },
    );

    return Number(result?.matchedCount ?? result?.n ?? 0) > 0;
}

module.exports = { consumeTotp };
