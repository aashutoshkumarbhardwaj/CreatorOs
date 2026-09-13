jest.mock('../../model/task', () => ({
  findOne: jest.fn(),
}));

const mongoose = require('mongoose');
const Task = require('../../model/task');
const { requireTaskOwnership } = require('../../middleware/taskOwnership');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

describe('requireTaskOwnership', () => {
  const originalReadyState = mongoose.connection.readyState;
  const originalMockDb = process.env.USE_MOCK_DB;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.USE_MOCK_DB = 'false';
    Object.defineProperty(mongoose.connection, 'readyState', {
      configurable: true,
      value: 1,
    });
  });

  afterAll(() => {
    process.env.USE_MOCK_DB = originalMockDb;
    Object.defineProperty(mongoose.connection, 'readyState', {
      configurable: true,
      value: originalReadyState,
    });
  });

  it('allows access when the task belongs to the authenticated creator', async () => {
    const taskId = new mongoose.Types.ObjectId().toString();
    const creatorId = new mongoose.Types.ObjectId().toString();
    const select = jest.fn().mockReturnThis();
    const lean = jest.fn().mockResolvedValue({ _id: taskId });
    Task.findOne.mockReturnValue({ select, lean });

    const req = {
      user: { id: creatorId },
      params: { id: taskId },
      body: { title: 'Updated task', creatorId: 'must-not-be-changed' },
    };
    const res = mockRes();
    const next = jest.fn();

    await requireTaskOwnership(req, res, next);

    expect(Task.findOne).toHaveBeenCalledWith({ _id: taskId, creatorId });
    expect(req.body.creatorId).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });

  it('rejects access when the task belongs to another creator', async () => {
    const taskId = new mongoose.Types.ObjectId().toString();
    const creatorId = new mongoose.Types.ObjectId().toString();
    const select = jest.fn().mockReturnThis();
    const lean = jest.fn().mockResolvedValue(null);
    Task.findOne.mockReturnValue({ select, lean });

    const req = {
      user: { id: creatorId },
      params: { id: taskId },
      body: {},
    };
    const res = mockRes();
    const next = jest.fn();

    await requireTaskOwnership(req, res, next);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ success: false, error: 'Task not found.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects invalid task ids without querying the database', async () => {
    const req = {
      user: { id: new mongoose.Types.ObjectId().toString() },
      params: { id: 'not-an-object-id' },
      body: {},
    };
    const res = mockRes();
    const next = jest.fn();

    await requireTaskOwnership(req, res, next);

    expect(Task.findOne).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('does not apply the database guard in mock mode', async () => {
    process.env.USE_MOCK_DB = 'true';

    const req = {
      user: { id: 'mock-user-123' },
      params: { id: 'mock-task-1' },
      body: {},
    };
    const res = mockRes();
    const next = jest.fn();

    await requireTaskOwnership(req, res, next);

    expect(Task.findOne).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
