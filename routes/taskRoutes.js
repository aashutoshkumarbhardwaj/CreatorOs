const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");

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
  exportCalendar,
} = require("../controller/taskController");

// Render Task Manager View Page
router.get("/services/task-manager", protect, getTaskManagerPage);

// Task API Endpoints
router.get("/api/tasks", protect, getTasks);
router.post("/api/tasks", protect, createTask);
router.get("/api/tasks/export/calendar", protect, exportCalendar);
router.get("/api/tasks/:id", protect, getTaskById);
router.put("/api/tasks/:id", protect, updateTask);
router.delete("/api/tasks/:id", protect, deleteTask);
router.patch("/api/tasks/:id/status", protect, updateTaskStatus);
router.patch("/api/tasks/:id/subtasks", protect, updateSubtasks);
router.post("/api/tasks/:id/time-log", protect, logTaskTime);
router.patch("/api/tasks/:id/archive", protect, toggleArchiveTask);

module.exports = router;
