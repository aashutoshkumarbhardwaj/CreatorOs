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

    if (req.body && typeof req.body === 'object') {
      delete req.body.creatorId;
      delete req.body._id;
      
      const stripMongoOperators = (rootObj) => {
        const stack = [rootObj];
        const visited = new WeakSet();

        while (stack.length > 0) {
          const current = stack.pop();
          if (!current || typeof current !== 'object') continue;
          if (visited.has(current)) continue;
          visited.add(current);
          
          if (Array.isArray(current)) {
            for (let i = 0; i < current.length; i++) {
              stack.push(current[i]);
            }
            continue;
          }

          for (const key in current) {
            if (key.startsWith('$')) {
              delete current[key];
            } else {
              stack.push(current[key]);
            }
          }
        }
      };

      stripMongoOperators(req.body);
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { requireTaskOwnership };
