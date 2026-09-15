jest.mock('../../model/task', () => ({
  find: jest.fn(),
}));

jest.mock('../../controller/taskController', () => ({
  exportCalendar: jest.fn(),
}));

const mongoose = require('mongoose');
const Task = require('../../model/task');
const { exportCalendarForCreator } = require('../../controller/taskExportController');

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

describe('exportCalendarForCreator', () => {
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

  it('exports only active tasks belonging to the authenticated creator', async () => {
    const creatorId = new mongoose.Types.ObjectId().toString();
    const dueDate = new Date('2026-09-20T10:00:00.000Z');
    const lean = jest.fn().mockResolvedValue([
      {
        _id: 'task-1',
        creatorId,
        title: 'Creator task',
        description: 'Private task',
        dueDate,
        status: 'todo',
        priority: 'high',
        category: 'content',
      },
    ]);
    Task.find.mockReturnValue({ lean });

    const req = { user: { id: creatorId } };
    const res = mockRes();
    const next = jest.fn();

    await exportCalendarForCreator(req, res, next);

    expect(Task.find).toHaveBeenCalledWith({ creatorId, isArchived: false });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      count: 1,
      events: [
        {
          id: 'task-1',
          title: 'Creator task',
          description: 'Private task',
          start: dueDate,
          end: dueDate,
          status: 'todo',
          priority: 'high',
          category: 'content',
        },
      ],
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('requires an authenticated creator when using the database', async () => {
    const req = { user: {} };
    const res = mockRes();
    const next = jest.fn();

    await exportCalendarForCreator(req, res, next);

    expect(Task.find).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ success: false, error: 'Authentication required.' });
  });
});
