const mongoose = require('mongoose');
const express = require('express');
const request = require('supertest');
const Task = require('../../model/task');

const USER_A = new mongoose.Types.ObjectId().toString();
const USER_B = new mongoose.Types.ObjectId().toString();

const mockProtect = jest.fn((req, res, next) => {
    req.user = { id: USER_A };
    next();
});

jest.mock('../../middleware/auth', () => ({
    protect: mockProtect,
}));

const taskRoutes = require('../../routes/taskRoutes');

const app = express();
app.use(express.json());
app.use(taskRoutes);

describe('Task Ownership IDOR & MongoDB Operator Integration', () => {
    beforeAll(() => {
        process.env.USE_MOCK_DB = 'false';
    });

    beforeEach(async () => {
        await Task.deleteMany({});
    });

    it('prevents a user from transferring task ownership via $set operator injection', async () => {
        const task = await Task.create({
            creatorId: USER_A,
            title: 'My original task',
            status: 'todo',
            priority: 'low',
            category: 'content',
        });

        const res = await request(app)
            .put('/api/tasks/' + task._id)
            .send({
                title: 'Updated title',
                $set: { creatorId: USER_B },
            });

        expect(res.status).toBe(200);

        const updatedTask = await Task.findById(task._id);

        expect(updatedTask.creatorId.toString()).toBe(USER_A);
        
        expect(updatedTask.title).toBe('Updated title');
    });
});
