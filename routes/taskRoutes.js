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
const collab = require("../controller/taskCollabController");

// Render Task Manager View Page
router.get("/services/task-manager", protect, getTaskManagerPage);

// Task API Endpoints
router.get("/api/tasks", protect, getTasks);
router.post("/api/tasks", protect, createTask);
router.get("/api/tasks/export/calendar", protect, exportCalendarForCreator);
// Registered before "/api/tasks/:id" so "views" is never read as a task id.
router.get("/api/tasks/views/:view", protect, collab.getView);
router.get("/api/tasks/link-options", protect, collab.getLinkOptions);
router.get("/api/tasks/:id", protect, requireTaskOwnership, getTaskById);
router.put("/api/tasks/:id", protect, requireTaskOwnership, updateTask);
router.delete("/api/tasks/:id", protect, requireTaskOwnership, deleteTask);
router.patch("/api/tasks/:id/status", protect, requireTaskOwnership, updateTaskStatus);
router.patch("/api/tasks/:id/subtasks", protect, requireTaskOwnership, updateSubtasks);
router.post("/api/tasks/:id/time-log", protect, requireTaskOwnership, logTaskTime);
router.patch("/api/tasks/:id/archive", protect, requireTaskOwnership, toggleArchiveTask);

// Team collaboration. These check workspace roles themselves, so assignees
// and teammates can act on tasks they did not create.
router.get("/api/tasks/:id/details", protect, collab.getTaskDetails);
router.patch("/api/tasks/:id/team", protect, collab.updateTeamTask);
router.post("/api/tasks/:id/comments", protect, collab.addComment);
router.delete("/api/tasks/:id/comments/:commentId", protect, collab.deleteComment);
router.post("/api/tasks/:id/links", protect, collab.addLink);
router.delete("/api/tasks/:id/links/:linkId", protect, collab.removeLink);
router.post("/api/tasks/:id/dependencies", protect, collab.addDependency);
router.delete("/api/tasks/:id/dependencies/:dependencyId", protect, collab.removeDependency);
router.post("/api/tasks/:id/watch", protect, collab.toggleWatch);

router.get("/api/workspaces", protect, collab.listWorkspaces);
router.post("/api/workspaces", protect, collab.createWorkspace);
router.get("/api/workspaces/:workspaceId", protect, collab.getWorkspace);
router.post("/api/workspaces/:workspaceId/members", protect, collab.addMember);
router.delete("/api/workspaces/:workspaceId/members/:userId", protect, collab.removeMember);
router.post("/api/workspaces/:workspaceId/projects", protect, collab.createProject);
router.put("/api/workspaces/:workspaceId/projects/:projectId", protect, collab.updateProject);
router.post("/api/workspaces/:workspaceId/tasks", protect, collab.createTeamTask);

router.get("/api/task-templates", protect, collab.listTemplates);
router.post("/api/task-templates/:key/apply", protect, collab.applyTemplate);

module.exports = router;
