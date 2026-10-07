const { createTeamTask, addDependency } = require("../../controller/teamTaskController");
const TeamTask = require("../../model/teamTaskDependency");
const { wouldCreateCycle } = require("../../services/taskDependencyService");
const mongoose = require("mongoose");

jest.mock("../../model/teamTaskDependency");
jest.mock("../../services/taskDependencyService");

describe("Team Task Controller Unit Tests", () => {
  let req;
  let res;
  const creatorId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      user: { _id: creatorId },
      body: {},
      params: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe("createTeamTask", () => {
    it("should set initialStatus to 'todo' when all blockers are already completed", async () => {
      const blockerId = new mongoose.Types.ObjectId().toString();
      req.body = {
        title: "Subsequent Task",
        blockedByIds: [blockerId],
      };

      TeamTask.find.mockResolvedValue([
        { _id: blockerId, status: "completed" },
      ]);

      let savedTaskData = null;
      TeamTask.mockImplementation(function (data) {
        savedTaskData = data;
        this.save = jest.fn().mockResolvedValue(this);
        this._id = new mongoose.Types.ObjectId().toString();
        Object.assign(this, data);
      });
      TeamTask.findOneAndUpdate = jest.fn().mockResolvedValue({});

      await createTeamTask(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(savedTaskData).not.toBeNull();
      expect(savedTaskData.status).toBe("todo");
    });

    it("should set initialStatus to 'blocked' when at least one blocker is uncompleted", async () => {
      const blocker1Id = new mongoose.Types.ObjectId().toString();
      const blocker2Id = new mongoose.Types.ObjectId().toString();
      req.body = {
        title: "Blocked Task",
        blockedByIds: [blocker1Id, blocker2Id],
      };

      TeamTask.find.mockResolvedValue([
        { _id: blocker1Id, status: "completed" },
        { _id: blocker2Id, status: "in_progress" },
      ]);

      let savedTaskData = null;
      TeamTask.mockImplementation(function (data) {
        savedTaskData = data;
        this.save = jest.fn().mockResolvedValue(this);
        this._id = new mongoose.Types.ObjectId().toString();
        Object.assign(this, data);
      });
      TeamTask.findOneAndUpdate = jest.fn().mockResolvedValue({});

      await createTeamTask(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(savedTaskData).not.toBeNull();
      expect(savedTaskData.status).toBe("blocked");
    });

    it("should deduplicate blockedByIds and not fail when duplicate IDs are provided", async () => {
      const blockerId = new mongoose.Types.ObjectId().toString();
      req.body = {
        title: "Task with duplicate blockers",
        blockedByIds: [blockerId, blockerId],
      };

      TeamTask.find.mockResolvedValue([
        { _id: blockerId, status: "completed" },
      ]);

      let savedTaskData = null;
      TeamTask.mockImplementation(function (data) {
        savedTaskData = data;
        this.save = jest.fn().mockResolvedValue(this);
        this._id = new mongoose.Types.ObjectId().toString();
        Object.assign(this, data);
      });
      TeamTask.findOneAndUpdate = jest.fn().mockResolvedValue({});

      await createTeamTask(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Team task created successfully",
        })
      );
    });

    it("should return 403 when one or more blocking tasks do not exist or belong to another creator", async () => {
      const blockerId = new mongoose.Types.ObjectId().toString();
      req.body = {
        title: "Unauthorized Task",
        blockedByIds: [blockerId],
      };

      TeamTask.find.mockResolvedValue([]);

      await createTeamTask(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "One or more blocking tasks do not exist or you do not have permission to access them.",
        })
      );
    });
  });

  describe("addDependency", () => {
    it("should return updatedTask with updated status and blockedBy in the response payload", async () => {
      const taskId = new mongoose.Types.ObjectId().toString();
      const prerequisiteTaskId = new mongoose.Types.ObjectId().toString();
      req.body = { taskId, prerequisiteTaskId };

      const existingTask = {
        _id: taskId,
        creatorId,
        status: "todo",
        blockedBy: [],
      };
      const prerequisiteTask = {
        _id: prerequisiteTaskId,
        creatorId,
        status: "in_progress",
      };

      TeamTask.findOne
        .mockResolvedValueOnce(existingTask)
        .mockResolvedValueOnce(prerequisiteTask);

      wouldCreateCycle.mockResolvedValue(false);

      const expectedUpdatedTask = {
        _id: taskId,
        creatorId,
        status: "blocked",
        blockedBy: [prerequisiteTaskId],
      };

      TeamTask.findOneAndUpdate
        .mockResolvedValueOnce(expectedUpdatedTask)
        .mockResolvedValueOnce({});

      await addDependency(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Dependency link established",
        task: expectedUpdatedTask,
      });
    });

    it("should reject circular dependencies with status 400", async () => {
      const taskId = new mongoose.Types.ObjectId().toString();
      const prerequisiteTaskId = new mongoose.Types.ObjectId().toString();
      req.body = { taskId, prerequisiteTaskId };

      TeamTask.findOne
        .mockResolvedValueOnce({ _id: taskId, creatorId })
        .mockResolvedValueOnce({ _id: prerequisiteTaskId, creatorId });

      wouldCreateCycle.mockResolvedValue(true);

      await addDependency(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Circular dependency rejected. Adding this blocker forms a cycle.",
        })
      );
    });
  });
});
