const mockConnectDB = jest.fn();
const mockFindById = jest.fn();
const mockFindOneAndUpdate = jest.fn();
const mockFindOne = jest.fn();
const mockUpdateOne = jest.fn();

jest.mock('../../connect', () => mockConnectDB);
jest.mock('../../model/user', () => ({
    findById: mockFindById,
}));
jest.mock('../../model/passwordResetToken', () => ({
    findOneAndUpdate: mockFindOneAndUpdate,
    findOne: mockFindOne,
    updateOne: mockUpdateOne,
}));
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

const { resetPassword } = require('../../controller/auth');

describe('resetPassword claimed token rollback', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFindOneAndUpdate.mockResolvedValue({
            _id: 'reset-token-1',
            userId: 'missing-user',
        });
        mockFindById.mockResolvedValue(null);
        mockUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    });

    test('releases a claimed reset token when the user cannot be found', async () => {
        const req = {
            body: {
                token: 'token-1',
                newPassword: 'Password123!',
            },
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };

        await resetPassword(req, res, jest.fn());

        expect(mockUpdateOne).toHaveBeenCalledWith(
            { _id: 'reset-token-1', used: true },
            { $set: { used: false }, $unset: { usedAt: "" } }
        );
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ success: false, message: 'User not found' });
    });
});
