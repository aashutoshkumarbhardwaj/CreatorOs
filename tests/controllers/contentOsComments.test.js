const mongoose = require('mongoose');
const ContentOsModel = require('../../model/contentOs');
const User = require('../../model/user');
const { addComment, deleteComment } = require('../../controller/contentOsController');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('Content OS comments', () => {
  let userId;
  let item;
  const realFindById = User.findById;

  beforeEach(async () => {
    await mongoose.connection.collection('contentos').deleteMany({}).catch(() => {});
    userId = new mongoose.Types.ObjectId();
    User.findById = () => ({ select: () => ({ lean: async () => ({ name: 'Rio' }) }) });
    item = await ContentOsModel.create({ userId, title: 'Launch video' });
  });

  afterEach(() => {
    User.findById = realFindById;
  });

  const comment = (text) =>
    addComment(
      { params: { id: item._id.toString() }, body: { text }, user: { id: userId.toString() } },
      mockRes()
    );

  it('keeps both comments when two are posted at the same time', async () => {
    await Promise.all([comment('first'), comment('second')]);

    const stored = await ContentOsModel.findById(item._id);
    expect(stored.comments.map((c) => c.text).sort()).toEqual(['first', 'second']);
  });

  it('deleting one comment leaves a comment added concurrently', async () => {
    await comment('keep me');
    const [toDelete] = (await ContentOsModel.findById(item._id)).comments;

    await Promise.all([
      deleteComment(
        {
          params: { id: item._id.toString(), commentId: toDelete._id.toString() },
          user: { id: userId.toString() },
        },
        mockRes()
      ),
      comment('added meanwhile'),
    ]);

    const stored = await ContentOsModel.findById(item._id);
    expect(stored.comments.map((c) => c.text)).toEqual(['added meanwhile']);
  });
});
