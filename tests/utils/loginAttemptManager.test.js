const mockGet = jest.fn();
const mockIncr = jest.fn();
const mockExpire = jest.fn();
const mockTtl = jest.fn();
const mockDel = jest.fn();

let mockClientInstance = {
    get: mockGet,
    incr: mockIncr,
    expire: mockExpire,
    ttl: mockTtl,
    del: mockDel,
};

jest.mock('../../utils/redisClient', () => ({
    createRedisClient: jest.fn(() => mockClientInstance),
    hasRedisConfig: jest.fn(() => true),
}));

const {
    getFailedLoginAttempts,
    getFailedResetAttempts,
    checkIfLoginLocked,
    recordFailedLoginAttempt,
    clearLoginAttempts,
    getLoginAttemptKey,
} = require('../../utils/loginAttemptManager');

describe('loginAttemptManager - getFailedLoginAttempts()', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should call redisClient.get() with ONLY the key (single argument)', async () => {
        mockGet.mockImplementation((...args) => {
            // Strictly enforce that Redis GET is called with only 1 argument (the key)
            if (args.length !== 1) {
                throw new Error("ERR wrong number of arguments for 'get' command");
            }
            return Promise.resolve('3');
        });

        const attempts = await getFailedLoginAttempts('user@example.com');

        expect(mockGet).toHaveBeenCalledTimes(1);
        expect(mockGet).toHaveBeenCalledWith('login_attempts:user@example.com');
        expect(mockGet.mock.calls[0].length).toBe(1);
        expect(attempts).toBe(3);
    });

    it('should correctly parse a stored string value like "3" as number 3 with radix 10', async () => {
        mockGet.mockResolvedValue('3');

        const attempts = await getFailedLoginAttempts('user@example.com');

        expect(attempts).toBe(3);
        expect(typeof attempts).toBe('number');
    });

    it('should return 0 when the key is not found in Redis (null)', async () => {
        mockGet.mockResolvedValue(null);

        const attempts = await getFailedLoginAttempts('user@example.com');

        expect(attempts).toBe(0);
    });

    it('should return 0 when the key value is empty string or undefined', async () => {
        mockGet.mockResolvedValue('');

        const attempts = await getFailedLoginAttempts('user@example.com');

        expect(attempts).toBe(0);
    });

    it('should handle Redis errors gracefully and return 0', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        mockGet.mockRejectedValue(new Error('Redis connection lost'));

        const attempts = await getFailedLoginAttempts('user@example.com');

        expect(attempts).toBe(0);
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it('should lock account when failed attempts reach MAX_LOGIN_ATTEMPTS (5)', async () => {
        mockGet.mockResolvedValue('5');

        const isLocked = await checkIfLoginLocked('user@example.com');

        expect(isLocked).toBe(true);
    });

    it('should not lock account when failed attempts are below threshold', async () => {
        mockGet.mockResolvedValue('4');

        const isLocked = await checkIfLoginLocked('user@example.com');

        expect(isLocked).toBe(false);
    });
});
