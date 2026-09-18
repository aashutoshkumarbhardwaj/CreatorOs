const { updateTask } = require('../../controller/taskController');
const Task = require('../../model/task');
const mongoose = require('mongoose');

jest.mock('../../model/task');

describe('Task Controller - updateTask', () => {
  let req;
  let res;
  const originalReadyState = mongoose.connection.readyState;
  const originalMockDb = process.env.USE_MOCK_DB;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      params: { id: 'task-123' },
      body: {},
    };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    process.env.USE_MOCK_DB = 'false';
    Object.defineProperty(mongoose.connection, 'readyState', {
      configurable: true,
      value: 1,
      writable: true,
    });
  });

  afterAll(() => {
    process.env.USE_MOCK_DB = originalMockDb;
    Object.defineProperty(mongoose.connection, 'readyState', {
      configurable: true,
      value: originalReadyState,
      writable: true,
    });
  });

  it('only maps allowlisted fields and prevents mass assignment', async () => {
    req.body = {
      title: 'Allowed Title',
      description: 'Allowed Description',
      status: 'in_progress',
      _id: 'injected_id',
      creatorId: 'injected_creator_id',
      spentHours: 999,
      isArchived: true,
      randomField: 'hacked'
    };

    Task.findByIdAndUpdate.mockResolvedValue({ _id: 'task-123', title: 'Allowed Title' });

    await updateTask(req, res);

    expect(Task.findByIdAndUpdate).toHaveBeenCalledWith(
      'task-123',
      {
        $set: {
          title: 'Allowed Title',
          description: 'Allowed Description',
          status: 'in_progress',
        },
      },
      { new: true }
    );
  });
});
