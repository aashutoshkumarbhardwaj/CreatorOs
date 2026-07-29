const mockConnectDB = jest.fn();
const mockFindOne = jest.fn();
const mockUpdateMany = jest.fn();
const mockCreate = jest.fn();
const mockSendPasswordResetEmail = jest.fn();

jest.mock('../../connect', () => mockConnectDB);
jest.mock('../../model/user', () => ({
    findOne: mockFindOne,
}));
jest.mock('../../model/passwordResetToken', () => ({
    updateMany: mockUpdateMany,
    create: mockCreate,
}));
jest.mock('../../utils/email', () => ({
    isEmailTransportConfigured: jest.fn(() => true),
    sendPasswordResetEmail: mockSendPasswordResetEmail,
}));
jest.mock('../../utils/loginAttemptManager', () => ({
    checkIfLoginLocked: jest.fn(),
    recordFailedLoginAttempt: jest.fn(),
    clearLoginAttempts: jest.fn(),
    getRemainingLoginLockoutTime: jest.fn(),
    checkIfResetLocked: jest.fn(() => false),
    recordFailedResetAttempt: jest.fn(),
    clearResetAttempts: jest.fn(),
    getRemainingResetLockoutTime: jest.fn(),
}));

const { requestPasswordReset } = require('../../controller/auth');

describe('requestPasswordReset token revocation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFindOne.mockResolvedValue({
            _id: 'user-1',
            email: 'creator@example.com',
            name: 'Creator',
        });
        mockUpdateMany.mockResolvedValue({ modifiedCount: 1 });
        mockCreate.mockResolvedValue({});
        mockSendPasswordResetEmail.mockResolvedValue();
    });

    test('revokes existing unused reset tokens before creating a new one', async () => {
        const req = {
            body: { email: ' Creator@Example.com ' },
            protocol: 'https',
            get: jest.fn((header) => header === 'host' ? 'app.test' : 'jest'),
            ip: '127.0.0.1',
        };
        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis(),
        };

        await requestPasswordReset(req, res, jest.fn());

        expect(mockUpdateMany).toHaveBeenCalledWith(
            { userId: 'user-1', used: false },
            {
                $set: {
                    used: true,
                    usedAt: expect.any(Date),
                },
            }
        );
        expect(mockCreate).toHaveBeenCalledTimes(1);
        expect(mockUpdateMany.mock.invocationCallOrder[0]).toBeLessThan(mockCreate.mock.invocationCallOrder[0]);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
});
