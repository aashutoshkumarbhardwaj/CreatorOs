process.env.USE_MOCK_DB = "true";
const User = require('../../model/user');

describe('User Model', () => {
    it('should create a new user in mock DB', async () => {
        const user = await User.create({ name: 'Bob', email: 'bob@example.com', password: '123' });
        expect(user.name).toBe('Bob');
        expect(user.email).toBe('bob@example.com');
    });

    it('should find user by email', async () => {
        await User.create({ name: 'Alice', email: 'alice@example.com', password: '123' });
        const user = await User.findOne({ email: 'alice@example.com' });
        expect(user).toBeDefined();
        expect(user.email).toBe('alice@example.com');
    });
});
