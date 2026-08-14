jest.mock('../../connect', () => jest.fn());
jest.mock('../../utils/email', () => ({
    isEmailTransportConfigured: jest.fn(() => true),
}));
jest.mock('../../utils/loginAttemptManager', () => ({
    checkIfLoginLocked: jest.fn(),
    recordFailedLoginAttempt: jest.fn(),
    clearLoginAttempts: jest.fn(),
    getRemainingLoginLockoutTime: jest.fn(),
    checkIfResetLocked: jest.fn(),
    recordFailedResetAttempt: jest.fn(),
    clearResetAttempts: jest.fn(),
    getRemainingResetLockoutTime: jest.fn(),
}));

const { isVerificationTokenExpired } = require('../../controller/auth');

describe('isVerificationTokenExpired', () => {
    test('treats missing expiry values as expired', () => {
        expect(isVerificationTokenExpired(undefined)).toBe(true);
        expect(isVerificationTokenExpired(null)).toBe(true);
    });

    test('treats invalid expiry values as expired', () => {
        expect(isVerificationTokenExpired('not-a-date')).toBe(true);
    });

    test('accepts future expiry values', () => {
        const future = new Date(Date.now() + 60_000);

        expect(isVerificationTokenExpired(future)).toBe(false);
    });
});
