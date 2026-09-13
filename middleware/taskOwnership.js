const mongoose = require("mongoose");
const Task = require("../model/task");

/**
 * Enforce creator ownership for task resources before the task controller runs.
 *
 * The Task Manager's mock mode keeps its own in-memory collection, so the
 * database ownership lookup is skipped there. Production/database-backed
 * requests must belong to the authenticated creator.
 */
const requireTaskOwnership = async (req, res, next) => {
  if (process.env.USE_MOCK_DB === "true" || mongoose.connection.readyState !== 1) {
    return next();
  }

  const creatorId = req.user?.id;
  const taskId = req.params.id;

  if (!creatorId || !mongoose.Types.ObjectId.isValid(taskId)) {
    return res.status(404).json({ success: false, error: "Task not found." });
  }

  try {
    const task = await Task.findOne({ _id: taskId, creatorId }).select("_id").lean();

    if (!task) {
      return res.status(404).json({ success: false, error: "Task not found." });
    }

    if (req.body && Object.prototype.hasOwnProperty.call(req.body, "creatorId")) {
      delete req.body.creatorId;
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { requireTaskOwnership };
