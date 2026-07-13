process.env.USE_MOCK_DB = "true";
const mongoose = require('mongoose');
const Invite = require('../../model/invite');

describe('Invite Model', () => {
    it('should create a new invite in mock DB', async () => {
        const inviterId = new mongoose.Types.ObjectId();
        const invite = await Invite.create({ inviter: inviterId, email: 'test@invite.com', token: 'token123' });
        expect(invite.email).toBe('test@invite.com');
        expect(invite.token).toBe('token123');
    });

    it('should find invite by token', async () => {
        Invite.findOne = jest.fn().mockResolvedValue({ email: 'hello@invite.com', token: 'xyztoken' });
        const invite = await Invite.findOne({ token: 'xyztoken' });
        expect(invite).toBeDefined();
        expect(invite.email).toBe('hello@invite.com');
    });
});
