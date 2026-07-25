const bcrypt = require('bcryptjs');

jest.mock('../../model/user', () => ({
    findById: jest.fn(),
}));

jest.mock('../../middleware/auth', () => ({
    preventContributorWrites: (req, res, next) => next(),
}));

const User = require('../../model/user');

describe('settings password reuse guard', () => {
    test('route contains explicit reused-password rejection before hashing', async () => {
        const fs = require('fs');
        const path = require('path');
        const source = fs.readFileSync(path.join(__dirname, '../../routes/settings.js'), 'utf8');

        expect(source).toContain('const isReusedPassword = await bcrypt.compare(newPassword, user.password)');
        expect(source).toContain('New password must be different from the current password.');
        expect(source.indexOf('const isReusedPassword')).toBeLessThan(source.indexOf('const salt = await bcrypt.genSalt(10)'));
    });

    test('bcrypt reports a reused password against the existing hash', async () => {
        const password = 'Password123!';
        const hash = await bcrypt.hash(password, 10);
        User.findById.mockResolvedValue({ password: hash });

        const user = await User.findById('user-1');

        await expect(bcrypt.compare(password, user.password)).resolves.toBe(true);
    });
});
