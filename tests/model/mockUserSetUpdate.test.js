describe('MockUserModel findByIdAndUpdate operators', () => {
    const originalUseMockDb = process.env.USE_MOCK_DB;
    let User;

    beforeEach(() => {
        jest.resetModules();
        process.env.USE_MOCK_DB = 'true';
        User = require('../../model/user');
    });

    afterEach(async () => {
        await User.deleteMany({ email: 'set-test@example.com' });
        if (originalUseMockDb === undefined) {
            delete process.env.USE_MOCK_DB;
        } else {
            process.env.USE_MOCK_DB = originalUseMockDb;
        }
    });

    test('applies $set updates in mock DB mode', async () => {
        const user = await User.create({
            name: 'Set Test',
            email: 'set-test@example.com',
            password: 'hashed',
            isVerified: true,
        });

        const updated = await User.findByIdAndUpdate(
            user._id,
            { $set: { name: 'Updated Name', alias: 'updated' } },
            { new: true }
        );

        expect(updated.name).toBe('Updated Name');
        expect(updated.alias).toBe('updated');
    });
});
