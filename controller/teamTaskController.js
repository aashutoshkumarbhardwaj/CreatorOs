const TeamTask = require("../model/teamTaskDependency");
const { wouldCreateCycle, topologicalSort, cascadeUnblockTasks } = require("../services/taskDependencyService");

/**
 * Create a team task
 */
exports.createTeamTask = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const {
      title,
      description,
      assigneeName,
      assigneeEmail,
      role,
      priority,
      estimatedHours,
      dueDate,
      blockedByIds,
    } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: "title is required" });
    }

    const hasBlockers = Array.isArray(blockedByIds) && blockedByIds.length > 0;
    const initialStatus = hasBlockers ? "blocked" : "todo";

    const task = new TeamTask({
      creatorId,
      title,
      description: description || "",
      assigneeName: assigneeName || "Unassigned",
      assigneeEmail: assigneeEmail || "",
      role: role || "video_editor",
      status: initialStatus,
      priority: priority || "medium",
      estimatedHours: estimatedHours || 2,
      dueDate: dueDate ? new Date(dueDate) : null,
      blockedBy: hasBlockers ? blockedByIds : [],
    });

    await task.save();

    // Link this task as dependent on the blockers
    if (hasBlockers) {
      for (const blockerId of blockedByIds) {
        await TeamTask.findByIdAndUpdate(blockerId, { $addToSet: { dependents: task._id } });
      }
    }

    return res.status(201).json({
      success: true,
      message: "Team task created successfully",
      task,
    });
  } catch (error) {
    console.error("Create team task error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create task",
      error: error.message,
    });
  }
};

/**
 * Get all team tasks for creator
 */
exports.getTeamTasks = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const { status, role, assignee } = req.query;

    const query = { creatorId };
    if (status) query.status = status;
    if (role) query.role = role;
    if (assignee) query.assigneeName = assignee;

    const tasks = await TeamTask.find(query)
      .populate("blockedBy", "title status assigneeName")
      .populate("dependents", "title status assigneeName")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: tasks.length,
      tasks,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching tasks", error: error.message });
  }
};

/**
 * Add dependency link with DAG cycle check
 */
exports.addDependency = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const { taskId, prerequisiteTaskId } = req.body;

    if (!taskId || !prerequisiteTaskId) {
      return res.status(400).json({ success: false, message: "taskId and prerequisiteTaskId are required" });
    }

    const [task, prerequisite] = await Promise.all([
      TeamTask.findOne({ _id: taskId, creatorId }),
      TeamTask.findOne({ _id: prerequisiteTaskId, creatorId }),
    ]);

    if (!task || !prerequisite) {
      return res.status(404).json({ success: false, message: "One or both tasks not found" });
    }

    const formsCycle = await wouldCreateCycle(taskId, prerequisiteTaskId);
    if (formsCycle) {
      return res.status(400).json({
        success: false,
        message: "Circular dependency rejected. Adding this blocker forms a cycle.",
      });
    }

    // Add prerequisite to blockedBy
    if (!task.blockedBy.includes(prerequisiteTaskId)) {
      task.blockedBy.push(prerequisiteTaskId);
      if (prerequisite.status !== "completed") {
        task.status = "blocked";
      }
      await task.save();
    }

    // Add task to prerequisite's dependents
    if (!prerequisite.dependents.includes(taskId)) {
      prerequisite.dependents.push(taskId);
      await prerequisite.save();
    }

    return res.status(200).json({
      success: true,
      message: "Dependency link established",
      task,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to add dependency", error: error.message });
  }
};

/**
 * Update status and cascade unblock dependent tasks
 */
exports.updateTaskStatus = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const { id } = req.params;
    const { status, loggedHours } = req.body;

    const task = await TeamTask.findOne({ _id: id, creatorId });
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    if (status) task.status = status;
    if (loggedHours !== undefined) task.loggedHours += Number(loggedHours);

    if (status === "completed") {
      task.completedAt = new Date();
    }

    await task.save();

    let unblocked = [];
    if (status === "completed") {
      unblocked = await cascadeUnblockTasks(task._id);
    }

    return res.status(200).json({
      success: true,
      message: "Task updated",
      task,
      unblockedDownstreamCount: unblocked.length,
      unblockedTasks: unblocked.map((u) => ({ id: u._id, title: u.title, status: u.status })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update task", error: error.message });
  }
};

/**
 * Get DAG execution order via topological sort
 */
exports.getExecutionOrder = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const tasks = await TeamTask.find({ creatorId });

    const ordered = topologicalSort(tasks);

    return res.status(200).json({
      success: true,
      count: ordered.length,
      executionOrder: ordered.map((t) => ({
        id: t._id,
        title: t.title,
        status: t.status,
        role: t.role,
        priority: t.priority,
      })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Topological sort failed", error: error.message });
  }
};
