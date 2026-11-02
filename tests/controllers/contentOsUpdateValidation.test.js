const mongoose = require('mongoose');
const ContentOsModel = require('../../model/contentOs');
const { updateItem, rescheduleItem } = require('../../controller/contentOsController');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('Content OS updates validate against the schema', () => {
  let userId;
  let item;

  beforeEach(async () => {
    userId = new mongoose.Types.ObjectId();
    item = await ContentOsModel.create({ userId, title: 'Launch video' });
  });

  const req = (body) => ({
    params: { id: item._id.toString() },
    body,
    user: { id: userId.toString() },
  });

  it.each([
    ['status', 'banana', 'idea'],
    ['platform', 'myspace', 'general'],
    ['type', 'unknown', 'idea'],
    ['priority', 'critical', 'medium'],
  ])('rejects invalid %s without storing any part of the update', async (field, value, original) => {
    const res = mockRes();
    await updateItem(req({ [field]: value, title: 'Must not persist' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    const stored = await ContentOsModel.findById(item._id);
    expect(stored[field]).toBe(original);
    expect(stored.title).toBe('Launch video');
  });

  it('still applies a valid update', async () => {
    const res = mockRes();
    await updateItem(req({ status: 'filming', title: 'Launch video v2' }), res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    const stored = await ContentOsModel.findById(item._id);
    expect(stored.status).toBe('filming');
    expect(stored.title).toBe('Launch video v2');
  });

  it('rejects an unknown status when rescheduling', async () => {
    const res = mockRes();
    await rescheduleItem(req({ scheduledAt: '2026-10-01T10:00:00Z', status: 'someday' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    const stored = await ContentOsModel.findById(item._id);
    expect(stored.status).toBe('idea');
    expect(stored.scheduledAt).toBeNull();
  });
});
