const mongoose = require("mongoose");
const Task = require("../model/task");
const asyncHandler = require("../utils/asyncHandler");
const { exportCalendar: exportMockCalendar } = require("./taskController");

/**
 * Export only the authenticated creator's active tasks.
 *
 * Mock mode delegates to the existing Task Manager export because its tasks
 * live in taskController's private in-memory collection.
 */
const exportCalendarForCreator = asyncHandler(async (req, res, next) => {
  if (process.env.USE_MOCK_DB === "true" || mongoose.connection.readyState !== 1) {
    return exportMockCalendar(req, res, next);
  }

  const creatorId = req.user?.id;
  if (!creatorId) {
    return res.status(401).json({ success: false, error: "Authentication required." });
  }

  const tasks = await Task.find({ creatorId, isArchived: false }).lean();
  const calendarEvents = tasks.map((task) => ({
    id: task._id,
    title: task.title,
    description: task.description || "",
    start: task.dueDate,
    end: task.dueDate,
    status: task.status,
    priority: task.priority,
    category: task.category,
  }));

  return res.json({
    success: true,
    count: calendarEvents.length,
    events: calendarEvents,
  });
});

module.exports = { exportCalendarForCreator };
