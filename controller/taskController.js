const Task = require("../model/task");
const User = require("../model/user");
const Invite = require("../model/invite");
const asyncHandler = require("../utils/asyncHandler");
const mongoose = require("mongoose");

let mockTasks = [
  {
    _id: "mock-task-1",
    creatorId: "60d5ecb8b5c9c62b3c7b3999",
    title: "Edit YouTube Tech Review & Sponsor Segment",
    description: "Finalize A-roll cut, add B-roll inserts, color grade, and render 4K video.",
    status: "in_progress",
    priority: "urgent",
    category: "content",
    tags: ["youtube", "editing", "sponsor"],
    startDate: new Date(),
    dueDate: new Date(Date.now() + 86400000 * 2),
    estimatedHours: 6,
    spentHours: 2.5,
    subtasks: [
      { _id: "st-1", title: "Cut A-Roll & Rough Edit", completed: true },
      { _id: "st-2", title: "Insert Sponsor B-Roll & Lower Thirds", completed: true },
      { _id: "st-3", title: "Render 4K timeline export", completed: false },
    ],
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: "mock-task-2",
    creatorId: "60d5ecb8b5c9c62b3c7b3999",
    title: "Finalize Brand Sponsorship Invoice",
    description: "Send invoice for July Tech Brand integration to accounting.",
    status: "todo",
    priority: "high",
    category: "sponsorship",
    tags: ["finance", "invoice"],
    startDate: new Date(),
    dueDate: new Date(Date.now() + 86400000 * 3),
    estimatedHours: 1,
    spentHours: 0,
    subtasks: [
      { _id: "st-4", title: "Generate PDF Invoice", completed: true },
      { _id: "st-5", title: "Email Brand Manager", completed: false },
    ],
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: "mock-task-3",
    creatorId: "60d5ecb8b5c9c62b3c7b3999",
    title: "Design Thumbnail & A/B Variants",
    description: "Create 3 high-CTR thumbnails with sharp text overlays.",
    status: "review",
    priority: "medium",
    category: "content",
    tags: ["design", "thumbnail"],
    startDate: new Date(),
    dueDate: new Date(Date.now() + 86400000 * 1),
    estimatedHours: 2,
    spentHours: 1.5,
    subtasks: [],
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: "mock-task-4",
    creatorId: "60d5ecb8b5c9c62b3c7b3999",
    title: "Weekly Analytics & Growth Audit",
    description: "Review watch time, subscriber retention, and engagement metrics.",
    status: "completed",
    priority: "low",
    category: "growth",
    tags: ["analytics", "growth"],
    startDate: new Date(Date.now() - 86400000 * 4),
    dueDate: new Date(Date.now() - 86400000 * 1),
    estimatedHours: 1.5,
    spentHours: 1.5,
    subtasks: [
      { _id: "st-6", title: "Export YouTube Studio CSV", completed: true },
      { _id: "st-7", title: "Update Growth Sheet", completed: true },
    ],
    completedAt: new Date(),
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

function isMockMode() {
  return process.env.USE_MOCK_DB === "true" || mongoose.connection.readyState !== 1;
}

function buildAccountViewModel(userDoc, fallbackUser) {
  const name = userDoc?.name || fallbackUser?.name || "Creator";
  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "CR";

  return {
    id: fallbackUser?.id || userDoc?._id || "mock-user-123",
    name,
    email: userDoc?.email || fallbackUser?.email || "mock@creator.os",
    initials,
  };
}

/**
 * Render Task Manager Page
 */
const getTaskManagerPage = asyncHandler(async (req, res) => {
  const creatorId = req.user?.id || "mock-user-123";
  let userDoc = null;
  let tasks = [];
  let invites = [];

  if (isMockMode()) {
    tasks = mockTasks;
    userDoc = { name: "Mock Creator", email: "mock@creator.os" };
  } else {
    userDoc = await User.findById(creatorId).select("name email").lean();
    [tasks, invites] = await Promise.all([
      Task.find({ creatorId }).populate("dependencies", "title status").sort({ createdAt: -1 }).lean(),
      Invite.find({ inviter: creatorId }).lean(),
    ]);
  }

  const now = new Date();
  const totalTasks = tasks.length;
  const activeTasks = tasks.filter((t) => !t.isArchived && t.status !== "completed" && t.status !== "cancelled").length;
  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const overdueTasks = tasks.filter(
    (t) => !t.isArchived && t.status !== "completed" && t.status !== "cancelled" && t.dueDate && new Date(t.dueDate) < now
  ).length;
  const totalSpentHours = tasks.reduce((sum, t) => sum + (t.spentHours || 0), 0);

  const tagsSet = new Set();
  tasks.forEach((t) => (t.tags || []).forEach((tag) => tagsSet.add(tag)));

  const stats = {
    totalTasks,
    activeTasks,
    completedTasks,
    overdueTasks,
    totalSpentHours: Math.round(totalSpentHours * 10) / 10,
  };

  res.render("task-manager", {
    user: buildAccountViewModel(userDoc, req.user),
    tasks,
    invites,
    stats,
    tags: Array.from(tagsSet),
    activeNav: "task-manager",
  });
});

/**
 * GET /api/tasks - List / Filter tasks
 */
const getTasks = asyncHandler(async (req, res) => {
  const creatorId = req.user?.id || "mock-user-123";
  const { search, status, priority, category, tag, isArchived } = req.query;

  if (isMockMode()) {
    let result = mockTasks.filter((t) => {
      if (isArchived === "true") return t.isArchived === true;
      if (isArchived === "false" || isArchived === undefined) return !t.isArchived;
      return true;
    });

    if (status) result = result.filter((t) => t.status === status);
    if (priority) result = result.filter((t) => t.priority === priority);
    if (category) result = result.filter((t) => t.category === category);
    if (tag) result = result.filter((t) => (t.tags || []).includes(tag));
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description || "").toLowerCase().includes(q) ||
          (t.tags || []).some((tg) => tg.toLowerCase().includes(q))
      );
    }
    return res.json({ success: true, count: result.length, tasks: result });
  }

  const query = { creatorId };
  if (isArchived === "true") query.isArchived = true;
  else if (isArchived === "false" || isArchived === undefined) query.isArchived = false;

  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (category) query.category = category;
  if (tag) query.tags = tag;
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { tags: { $regex: search, $options: "i" } },
    ];
  }

  const tasks = await Task.find(query)
    .populate("dependencies", "title status priority dueDate")
    .sort({ createdAt: -1 })
    .lean();

  res.json({ success: true, count: tasks.length, tasks });
});

/**
 * GET /api/tasks/:id - Get single task
 */
const getTaskById = asyncHandler(async (req, res) => {
  const creatorId = req.user?.id || "mock-user-123";

  if (isMockMode()) {
    const task = mockTasks.find((t) => t._id === req.params.id);
    if (!task) return res.status(404).json({ success: false, error: "Task not found." });
    return res.json({ success: true, task });
  }

  const task = await Task.findOne({ _id: req.params.id, creatorId })
    .populate("dependencies", "title status priority dueDate")
    .lean();

  if (!task) return res.status(404).json({ success: false, error: "Task not found." });
  res.json({ success: true, task });
});

/**
 * POST /api/tasks - Create task
 */
const createTask = asyncHandler(async (req, res) => {
  const creatorId = req.user?.id || "mock-user-123";
  const { title, description, status, priority, category, tags, startDate, dueDate, estimatedHours, subtasks } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ success: false, error: "Task title is required." });
  }

  const formattedTags = Array.isArray(tags)
    ? tags.map((t) => t.trim()).filter(Boolean)
    : typeof tags === "string"
    ? tags.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const newTaskObj = {
    _id: `task_${Date.now()}`,
    creatorId,
    title: title.trim(),
    description: description ? description.trim() : "",
    status: status || "todo",
    priority: priority || "medium",
    category: category || "content",
    tags: formattedTags,
    startDate: startDate ? new Date(startDate) : undefined,
    dueDate: dueDate ? new Date(dueDate) : undefined,
    estimatedHours: Number(estimatedHours) || 0,
    spentHours: 0,
    subtasks: Array.isArray(subtasks) ? subtasks.map((s, idx) => ({ _id: `st_${Date.now()}_${idx}`, title: s.title, completed: !!s.completed })) : [],
    dependencies: [],
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (isMockMode()) {
    mockTasks.unshift(newTaskObj);
    return res.status(201).json({ success: true, task: newTaskObj });
  }

  const taskDoc = await Task.create({
    creatorId,
    title: title.trim(),
    description: description ? description.trim() : "",
    status: status || "todo",
    priority: priority || "medium",
    category: category || "content",
    tags: formattedTags,
    startDate: startDate ? new Date(startDate) : undefined,
    dueDate: dueDate ? new Date(dueDate) : undefined,
    estimatedHours: Number(estimatedHours) || 0,
    subtasks: Array.isArray(subtasks) ? subtasks : [],
  });

  res.status(201).json({ success: true, task: taskDoc });
});

/**
 * PUT /api/tasks/:id - Update task
 */
const updateTask = asyncHandler(async (req, res) => {
  const taskId = req.params.id;

  if (isMockMode()) {
    const idx = mockTasks.findIndex((t) => t._id === taskId);
    if (idx === -1) return res.status(404).json({ success: false, error: "Task not found." });

    const updated = { ...mockTasks[idx], ...req.body, updatedAt: new Date() };
    mockTasks[idx] = updated;
    return res.json({ success: true, task: updated });
  }

  const taskDoc = await Task.findByIdAndUpdate(taskId, req.body, { new: true });
  res.json({ success: true, task: taskDoc });
});

/**
 * PATCH /api/tasks/:id/status - Quick status update
 */
const updateTaskStatus = asyncHandler(async (req, res) => {
  const taskId = req.params.id;
  const { status } = req.body;

  if (isMockMode()) {
    const task = mockTasks.find((t) => t._id === taskId);
    if (!task) return res.status(404).json({ success: false, error: "Task not found." });
    task.status = status;
    return res.json({ success: true, task });
  }

  const taskDoc = await Task.findByIdAndUpdate(taskId, { status }, { new: true });
  res.json({ success: true, task: taskDoc });
});

/**
 * PATCH /api/tasks/:id/subtasks - Update subtasks
 */
const updateSubtasks = asyncHandler(async (req, res) => {
  const taskId = req.params.id;
  const { subtasks } = req.body;

  if (isMockMode()) {
    const task = mockTasks.find((t) => t._id === taskId);
    if (!task) return res.status(404).json({ success: false, error: "Task not found." });
    task.subtasks = subtasks;
    return res.json({ success: true, task });
  }

  const taskDoc = await Task.findByIdAndUpdate(taskId, { subtasks }, { new: true });
  res.json({ success: true, task: taskDoc });
});

/**
 * POST /api/tasks/:id/time-log - Log time spent
 */
const logTaskTime = asyncHandler(async (req, res) => {
  const taskId = req.params.id;
  const { durationMinutes } = req.body;
  const hours = Number(durationMinutes) / 60;

  if (isMockMode()) {
    const task = mockTasks.find((t) => t._id === taskId);
    if (!task) return res.status(404).json({ success: false, error: "Task not found." });
    task.spentHours = Math.round(((task.spentHours || 0) + hours) * 100) / 100;
    return res.json({ success: true, task });
  }

  const taskDoc = await Task.findById(taskId);
  if (!taskDoc) return res.status(404).json({ success: false, error: "Task not found." });

  taskDoc.spentHours = Math.round(((taskDoc.spentHours || 0) + hours) * 100) / 100;
  await taskDoc.save();
  res.json({ success: true, task: taskDoc });
});

/**
 * PATCH /api/tasks/:id/archive - Toggle archive state
 */
const toggleArchiveTask = asyncHandler(async (req, res) => {
  const taskId = req.params.id;

  if (isMockMode()) {
    const task = mockTasks.find((t) => t._id === taskId);
    if (!task) return res.status(404).json({ success: false, error: "Task not found." });
    task.isArchived = !task.isArchived;
    task.archivedAt = task.isArchived ? new Date() : null;
    return res.json({ success: true, task });
  }

  const taskDoc = await Task.findById(taskId);
  if (!taskDoc) return res.status(404).json({ success: false, error: "Task not found." });
  taskDoc.isArchived = !taskDoc.isArchived;
  await taskDoc.save();
  res.json({ success: true, task: taskDoc });
});

/**
 * DELETE /api/tasks/:id - Delete task
 */
const deleteTask = asyncHandler(async (req, res) => {
  const taskId = req.params.id;

  if (isMockMode()) {
    mockTasks = mockTasks.filter((t) => t._id !== taskId);
    return res.json({ success: true, message: "Task deleted successfully." });
  }

  await Task.findByIdAndDelete(taskId);
  res.json({ success: true, message: "Task deleted successfully." });
});

/**
 * GET /api/tasks/export/calendar - Export calendar feed
 */
const exportCalendar = asyncHandler(async (req, res) => {
  const tasks = isMockMode() ? mockTasks : await Task.find({ isArchived: false }).lean();
  const calendarEvents = tasks.map((t) => ({
    id: t._id,
    title: t.title,
    description: t.description || "",
    start: t.dueDate,
    end: t.dueDate,
    status: t.status,
    priority: t.priority,
    category: t.category,
  }));

  res.json({ success: true, count: calendarEvents.length, events: calendarEvents });
});

module.exports = {
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
};
