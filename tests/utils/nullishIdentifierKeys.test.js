const {
    getLoginAttemptKey,
    getResetAttemptKey,
} = require('../../utils/loginAttemptManager');
const { getProfileCacheKey } = require('../../utils/profileCache');

describe('nullish identifier key helpers', () => {
    test.each([
        [undefined, 'login_attempts:'],
        [null, 'login_attempts:'],
        ['User@Example.com', 'login_attempts:user@example.com'],
    ])('getLoginAttemptKey(%p)', (input, expected) => {
        expect(getLoginAttemptKey(input)).toBe(expected);
    });

    test.each([
        [undefined, 'reset_attempts:'],
        [null, 'reset_attempts:'],
        ['User@Example.com', 'reset_attempts:user@example.com'],
    ])('getResetAttemptKey(%p)', (input, expected) => {
        expect(getResetAttemptKey(input)).toBe(expected);
    });

    test.each([
        [undefined, 'profile:'],
        [null, 'profile:'],
        ['CreatorName', 'profile:creatorname'],
    ])('getProfileCacheKey(%p)', (input, expected) => {
        expect(getProfileCacheKey(input)).toBe(expected);
    });
});
