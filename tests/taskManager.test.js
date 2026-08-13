const Task = require('../model/task');
const mongoose = require('mongoose');

describe('Task Model Test Suite', () => {
  it('should invalidate task creation without a title', async () => {
    const task = new Task({
      creatorId: new mongoose.Types.ObjectId(),
    });

    let err;
    try {
      await task.validate();
    } catch (error) {
      err = error;
    }

    expect(err).toBeDefined();
    expect(err.errors.title).toBeDefined();
  });

  it('should create a valid task document with default values', () => {
    const creatorId = new mongoose.Types.ObjectId();
    const task = new Task({
      creatorId,
      title: 'Script YouTube Video',
      category: 'content',
      priority: 'high',
    });

    expect(task.title).toBe('Script YouTube Video');
    expect(task.status).toBe('todo');
    expect(task.isArchived).toBe(false);
    expect(task.priority).toBe('high');
    expect(task.category).toBe('content');
    expect(task.estimatedHours).toBe(0);
    expect(task.spentHours).toBe(0);
  });
});
