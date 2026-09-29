const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  createTeamTask,
  getTeamTasks,
  addDependency,
  updateTaskStatus,
  getExecutionOrder,
} = require("../controller/teamTaskController");

router.use(protect);

router.get("/", getTeamTasks);
router.post("/", createTeamTask);
router.patch("/:id/status", updateTaskStatus);
router.post("/dependency", addDependency);
router.get("/execution-order", getExecutionOrder);

module.exports = router;
