const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { requireTaskOwnership } = require("../middleware/taskOwnership");
const { exportCalendarForCreator } = require("../controller/taskExportController");

const {
  getTaskManagerPage,
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  updateTaskStatus,
  updateSubtasks,
  logTaskTime,
  toggleArchiveTask,
  deleteTask,
} = require("../controller/taskController");

const { sanitizeNoSqlQuery } = require("../middleware/validators/common");

// Render Task Manager View Page
router.get("/services/task-manager", protect, getTaskManagerPage);

// Task API Endpoints
router.get("/api/tasks", protect, sanitizeNoSqlQuery(), getTasks);
router.post("/api/tasks", protect, createTask);
router.get("/api/tasks/export/calendar", protect, exportCalendarForCreator);
router.get("/api/tasks/:id", protect, requireTaskOwnership, getTaskById);
router.put("/api/tasks/:id", protect, requireTaskOwnership, updateTask);
router.delete("/api/tasks/:id", protect, requireTaskOwnership, deleteTask);
router.patch("/api/tasks/:id/status", protect, requireTaskOwnership, updateTaskStatus);
router.patch("/api/tasks/:id/subtasks", protect, requireTaskOwnership, updateSubtasks);
router.post("/api/tasks/:id/time-log", protect, requireTaskOwnership, logTaskTime);
router.patch("/api/tasks/:id/archive", protect, requireTaskOwnership, toggleArchiveTask);

module.exports = router;
