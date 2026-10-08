const mongoose = require("mongoose");
const TeamTask = require("../model/teamTaskDependency");
const {
  wouldCreateCycle,
  topologicalSort,
  findUnsortableTasks,
  getPendingBlockers,
  cascadeUnblockTasks,
  cascadeReblockTasks,
} = require("../services/taskDependencyService");

const VALID_STATUSES = ["blocked", "todo", "in_progress", "in_review", "completed"];

const getCreatorId = (req) => (req.user && req.user._id ? req.user._id : req.user);

/**
 * Create a team task
 */
exports.createTeamTask = async (req, res) => {
  try {
    const creatorId = getCreatorId(req);
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

    // De-duplicate and validate blocker ids up front (a CastError would otherwise become a 500)
    const uniqueBlockerIds = Array.isArray(blockedByIds)
      ? [...new Set(blockedByIds.map((b) => String(b)))]
      : [];
    if (uniqueBlockerIds.some((b) => !mongoose.isValidObjectId(b))) {
      return res.status(400).json({ success: false, message: "blockedByIds contains an invalid id" });
    }

    // IDOR / BAC Fix: Verify all blockers belong to the same creator before allowing dependency linkage
    let validBlockers = [];
    let pendingCount = 0;
    if (uniqueBlockerIds.length > 0) {
      const blockers = await TeamTask.find({ _id: { $in: uniqueBlockerIds }, creatorId });
      if (blockers.length !== uniqueBlockerIds.length) {
        return res.status(403).json({ success: false, message: "One or more blocking tasks do not exist or you do not have permission to access them." });
      }
      validBlockers = blockers.map((b) => b._id);
      pendingCount = blockers.filter((b) => b.status !== "completed").length;
    }

    // Only block on prerequisites that are actually unfinished; otherwise nothing would
    // ever trigger the cascade that unblocks this task.
    const initialStatus = pendingCount > 0 ? "blocked" : "todo";

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
      blockedBy: validBlockers,
    });

    await task.save();

    let responseTask = task;
    if (validBlockers.length > 0) {
      await TeamTask.updateMany(
        { _id: { $in: validBlockers }, creatorId },
        { $addToSet: { dependents: task._id } }
      );

      // A blocker may have completed after we read it but before the dependents link existed,
      // in which case its cascade could not see this task. Re-check now that the link exists.
      if (initialStatus === "blocked") {
        const stillPending = await getPendingBlockers(validBlockers);
        if (stillPending.length === 0) {
          const unblocked = await TeamTask.findOneAndUpdate(
            { _id: task._id, creatorId, status: "blocked" },
            { $set: { status: "todo" } },
            { new: true }
          );
          if (unblocked) responseTask = unblocked;
        }
      }
    }

    return res.status(201).json({
      success: true,
      message: "Team task created successfully",
      task: responseTask,
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
    const creatorId = getCreatorId(req);
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
    const creatorId = getCreatorId(req);
    const { taskId, prerequisiteTaskId } = req.body;

    if (!taskId || !prerequisiteTaskId) {
      return res.status(400).json({ success: false, message: "taskId and prerequisiteTaskId are required" });
    }
    if (!mongoose.isValidObjectId(taskId) || !mongoose.isValidObjectId(prerequisiteTaskId)) {
      return res.status(400).json({ success: false, message: "taskId and prerequisiteTaskId must be valid ids" });
    }

    const [task, prerequisite] = await Promise.all([
      TeamTask.findOne({ _id: taskId, creatorId }),
      TeamTask.findOne({ _id: prerequisiteTaskId, creatorId }),
    ]);

    if (!task || !prerequisite) {
      return res.status(404).json({ success: false, message: "One or both tasks not found" });
    }

    // Idempotent: the link already exists
    if ((task.blockedBy || []).some((b) => String(b) === String(prerequisiteTaskId))) {
      return res.status(200).json({ success: true, message: "Dependency link already exists", task });
    }

    if (await wouldCreateCycle(taskId, prerequisiteTaskId, creatorId)) {
      return res.status(400).json({
        success: false,
        message: "Circular dependency rejected. Adding this blocker forms a cycle.",
      });
    }

    // Write both sides of the edge
    await TeamTask.findOneAndUpdate(
      { _id: taskId, creatorId },
      { $addToSet: { blockedBy: prerequisiteTaskId } }
    );
    await TeamTask.findOneAndUpdate(
      { _id: prerequisiteTaskId, creatorId },
      { $addToSet: { dependents: taskId } }
    );

    // The check above and the writes are not one atomic step: two concurrent requests
    // (A<-B and B<-A) can both pass the pre-check and together create a cycle, deadlocking
    // both tasks forever. Re-verify with the edge in place and roll back if it closed a cycle.
    if (await wouldCreateCycle(taskId, prerequisiteTaskId, creatorId)) {
      await TeamTask.findOneAndUpdate({ _id: taskId, creatorId }, { $pull: { blockedBy: prerequisiteTaskId } });
      await TeamTask.findOneAndUpdate({ _id: prerequisiteTaskId, creatorId }, { $pull: { dependents: taskId } });
      return res.status(409).json({
        success: false,
        message: "Circular dependency rejected. A concurrent change would have formed a cycle; please retry.",
      });
    }

    // Block the task only if the prerequisite is genuinely unfinished (fresh read), and never
    // touch a task that is already completed.
    const pending = await getPendingBlockers([prerequisiteTaskId]);
    if (pending.length > 0) {
      await TeamTask.findOneAndUpdate(
        { _id: taskId, creatorId, status: { $in: ["todo", "in_progress", "in_review"] } },
        { $set: { status: "blocked" } }
      );

      // If the prerequisite completed while we were blocking, its cascade ran before the task
      // was blocked and would never run again. Re-check and unblock to avoid a stuck task.
      const recheck = await getPendingBlockers([prerequisiteTaskId]);
      if (recheck.length === 0) {
        await cascadeUnblockTasks(prerequisiteTaskId, creatorId);
      }
    }

    const updatedTask = await TeamTask.findOne({ _id: taskId, creatorId });

    return res.status(200).json({
      success: true,
      message: "Dependency link established",
      task: updatedTask,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to add dependency", error: error.message });
  }
};

/**
 * Update status, enforce dependency rules, and cascade to downstream tasks
 */
exports.updateTaskStatus = async (req, res) => {
  try {
    const creatorId = getCreatorId(req);
    const { id } = req.params;
    const { status, loggedHours } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid task id" });
    }
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${VALID_STATUSES.join(", ")}` });
    }
    if (loggedHours !== undefined) {
      const hours = Number(loggedHours);
      if (!Number.isFinite(hours) || hours < 0) {
        return res.status(400).json({ success: false, message: "loggedHours must be a non-negative number" });
      }
    }

    const existing = await TeamTask.findOne({ _id: id, creatorId }).select("status blockedBy");
    if (!existing) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    const wasCompleted = existing.status === "completed";

    if (status) {
      // A task with unfinished blockers can only be "blocked"; one without can never be "blocked".
      // This stops the DAG from being bypassed (e.g. completing a task whose prerequisite is
      // unfinished, which would then wrongly unblock everything downstream) and stops tasks
      // from being parked in "blocked" with nothing left to unblock them.
      const pending = await getPendingBlockers(existing.blockedBy);
      if (pending.length > 0 && status !== "blocked") {
        return res.status(409).json({
          success: false,
          message: "Task still has unresolved blockers and cannot change to this status.",
          pendingBlockers: pending.map((b) => ({ id: b._id, title: b.title, status: b.status })),
        });
      }
      if (pending.length === 0 && status === "blocked") {
        return res.status(409).json({
          success: false,
          message: "Task has no unresolved blockers, so it cannot be marked as blocked.",
        });
      }
    }

    const updatePayload = {};
    if (status) {
      updatePayload.$set = { status };
      if (status === "completed") {
        updatePayload.$set.completedAt = new Date();
      } else if (wasCompleted) {
        updatePayload.$unset = { completedAt: "" };
      }
    }
    if (loggedHours !== undefined) {
      updatePayload.$inc = { loggedHours: Number(loggedHours) };
    }

    const updatedTask = await TeamTask.findOneAndUpdate(
      { _id: id, creatorId },
      updatePayload,
      { new: true, runValidators: true }
    );
    if (!updatedTask) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    let unblocked = [];
    if (status === "completed" && !wasCompleted) {
      unblocked = await cascadeUnblockTasks(updatedTask._id, creatorId);
    } else if (status && status !== "completed" && wasCompleted) {
      // Reopened: downstream tasks that have not started must wait for it again
      await cascadeReblockTasks(updatedTask._id, creatorId);
    }

    return res.status(200).json({
      success: true,
      message: "Task updated",
      task: updatedTask,
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
    const creatorId = getCreatorId(req);
    const tasks = await TeamTask.find({ creatorId });

    const ordered = topologicalSort(tasks);
    const cyclic = findUnsortableTasks(tasks, ordered);

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
      // Tasks on (or behind) a dependency cycle, reported instead of silently omitted
      cyclicTasks: cyclic.map((t) => ({ id: t._id, title: t.title, status: t.status })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Topological sort failed", error: error.message });
  }
};
