const mongoose = require("mongoose");
const Task = require("../model/task");
const Workspace = require("../model/workspace");
const User = require("../model/user");
const asyncHandler = require("../utils/asyncHandler");
const escapeRegex = require("../utils/escapeRegex");
const collab = require("../services/taskCollabService");

const BOARD_STATUSES = ["todo", "in_progress", "review", "completed", "cancelled"];
const PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const BOARD_COLUMN_LIMIT = 100;

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const sameId = (a, b) => Boolean(a) && Boolean(b) && String(a) === String(b);

// find() casts string ids, aggregate() does not; the same query feeds both.
const toObjectId = (id) => (isValidId(id) ? new mongoose.Types.ObjectId(String(id)) : id);

const isMockMode = () =>
  process.env.USE_MOCK_DB === "true" || mongoose.connection.readyState !== 1;

const fail = (res, status, error) => res.status(status).json({ success: false, error });

function requireDatabase(res) {
  if (!isMockMode()) return true;
  fail(res, 503, "Team features need a database connection.");
  return false;
}

/**
 * Resolve the workspace named by the request and the caller's role in it.
 * Non-members get 404 rather than 403 so workspace ids cannot be probed.
 */
async function loadWorkspace(req, res, capability) {
  const id =
    req.params.workspaceId || (req.body && req.body.workspaceId) || req.query.workspaceId;

  const workspace = isValidId(id)
    ? await Workspace.findOne({ _id: id, isArchived: false })
    : null;
  const role = collab.resolveWorkspaceRole(workspace, req.user.id);

  if (!role) {
    fail(res, 404, "Workspace not found.");
    return null;
  }
  if (capability && !collab.roleCan(role, capability)) {
    fail(res, 403, "You do not have permission to do that in this workspace.");
    return null;
  }

  return { workspace, role };
}

/**
 * Load a task and check the caller may perform `capability` on it. Tasks the
 * caller cannot see return 404; visible tasks they cannot change return 403.
 */
async function loadTask(req, res, capability = "task.view") {
  const task = isValidId(req.params.id) ? await Task.findById(req.params.id) : null;

  let workspace = null;
  let role = null;

  if (task && task.workspaceId) {
    workspace = await Workspace.findById(task.workspaceId).lean();
    const project = workspace && task.projectId
      ? (workspace.projects || []).find((p) => sameId(p._id, task.projectId))
      : null;
    role = collab.resolveProjectRole(workspace, project, req.user.id);
  }

  const context = { role, userId: req.user.id, task };

  if (!task || !collab.canAccessTask("task.view", context)) {
    fail(res, 404, "Task not found.");
    return null;
  }
  if (capability !== "task.view" && !collab.canAccessTask(capability, context)) {
    fail(res, 403, "You do not have permission to change this task.");
    return null;
  }

  return { task, workspace, role };
}

const canModerate = (ctx, userId) =>
  ["owner", "admin"].includes(ctx.role) || sameId(ctx.task.creatorId, userId);

function memberIds(workspace) {
  if (!workspace) return new Set();
  return new Set([
    String(workspace.ownerId),
    ...(workspace.members || []).map((m) => String(m.userId)),
  ]);
}

/** Build assignedTo entries for workspace members only. */
async function buildAssignees(workspace, ids) {
  const allowed = memberIds(workspace);
  const valid = [...new Set((ids || []).map(String))].filter(
    (id) => isValidId(id) && allowed.has(id)
  );
  if (!valid.length) return [];

  const users = await User.find({ _id: { $in: valid } }).select("name email").lean();
  return users.map((u) => ({ userId: u._id, name: u.name || "", email: u.email || "" }));
}

function recordActivity(task, actorId, type, extra = {}) {
  task.activity.push({ actorId, type, ...extra });
  task.lastActivityAt = new Date();
}

// ---------------------------------------------------------------------------
// Workspaces and projects
// ---------------------------------------------------------------------------

/** GET /api/workspaces */
const listWorkspaces = asyncHandler(async (req, res) => {
  if (isMockMode()) return res.json({ success: true, workspaces: [] });

  const workspaces = await Workspace.find({
    isArchived: false,
    $or: [{ ownerId: req.user.id }, { "members.userId": req.user.id }],
  })
    .select("name icon ownerId members projects._id projects.name projects.status")
    .sort({ createdAt: 1 })
    .lean();

  res.json({
    success: true,
    workspaces: workspaces.map((w) => ({
      ...w,
      role: collab.resolveWorkspaceRole(w, req.user.id),
    })),
  });
});

/** POST /api/workspaces */
const createWorkspace = asyncHandler(async (req, res) => {
  if (!requireDatabase(res)) return;

  const name = String((req.body && req.body.name) || "").trim();
  if (!name) return fail(res, 400, "Workspace name is required.");

  const workspace = await Workspace.create({
    ownerId: req.user.id,
    name,
    icon: req.body.icon || "🗂️",
    members: [{ userId: req.user.id, role: "owner" }],
  });

  res.status(201).json({ success: true, workspace });
});

/** GET /api/workspaces/:workspaceId - members and projects with task counts. */
const getWorkspace = asyncHandler(async (req, res) => {
  if (!requireDatabase(res)) return;

  const ctx = await loadWorkspace(req, res, "task.view");
  if (!ctx) return;

  await ctx.workspace.populate("members.userId", "name email");

  const counts = await Task.aggregate([
    { $match: { workspaceId: ctx.workspace._id, isArchived: false } },
    { $group: { _id: "$projectId", total: { $sum: 1 } } },
  ]);
  const countFor = (id) => (counts.find((c) => sameId(c._id, id)) || {}).total || 0;

  const workspace = ctx.workspace.toObject();
  workspace.projects = workspace.projects.map((p) => ({ ...p, taskCount: countFor(p._id) }));

  res.json({ success: true, role: ctx.role, workspace });
});

/** POST /api/workspaces/:workspaceId/members - add or change a member by email. */
const addMember = asyncHandler(async (req, res) => {
  if (!requireDatabase(res)) return;

  const ctx = await loadWorkspace(req, res, "workspace.invite");
  if (!ctx) return;

  const email = String(req.body.email || "").trim().toLowerCase();
  const role = req.body.role || "member";

  if (!email) return fail(res, 400, "Member email is required.");
  if (!["admin", "member", "guest"].includes(role)) return fail(res, 400, "Invalid role.");
  // Only the owner may create admins.
  if (role === "admin" && ctx.role !== "owner") {
    return fail(res, 403, "Only the workspace owner can add admins.");
  }

  const user = await User.findOne({ email }).select("_id").lean();
  if (!user) return fail(res, 404, "No CreatorOS user with that email.");
  if (sameId(user._id, ctx.workspace.ownerId)) return fail(res, 400, "The owner is already a member.");

  const existing = ctx.workspace.members.find((m) => sameId(m.userId, user._id));
  if (existing) existing.role = role;
  else ctx.workspace.members.push({ userId: user._id, role });

  await ctx.workspace.save();
  res.status(201).json({ success: true, members: ctx.workspace.members });
});

/** DELETE /api/workspaces/:workspaceId/members/:userId */
const removeMember = asyncHandler(async (req, res) => {
  if (!requireDatabase(res)) return;

  const ctx = await loadWorkspace(req, res, "workspace.invite");
  if (!ctx) return;

  if (sameId(req.params.userId, ctx.workspace.ownerId)) {
    return fail(res, 400, "The workspace owner cannot be removed.");
  }

  ctx.workspace.members = ctx.workspace.members.filter(
    (m) => !sameId(m.userId, req.params.userId)
  );
  await ctx.workspace.save();

  res.json({ success: true, members: ctx.workspace.members });
});

/** POST /api/workspaces/:workspaceId/projects */
const createProject = asyncHandler(async (req, res) => {
  if (!requireDatabase(res)) return;

  const ctx = await loadWorkspace(req, res, "project.manage");
  if (!ctx) return;

  const name = String(req.body.name || "").trim();
  if (!name) return fail(res, 400, "Project name is required.");

  ctx.workspace.projects.push({
    name,
    description: req.body.description || "",
    color: req.body.color || undefined,
    createdBy: req.user.id,
  });
  await ctx.workspace.save();

  res.status(201).json({
    success: true,
    project: ctx.workspace.projects[ctx.workspace.projects.length - 1],
  });
});

/** PUT /api/workspaces/:workspaceId/projects/:projectId */
const updateProject = asyncHandler(async (req, res) => {
  if (!requireDatabase(res)) return;

  const ctx = await loadWorkspace(req, res, "project.manage");
  if (!ctx) return;

  const project = ctx.workspace.projects.id(req.params.projectId);
  if (!project) return fail(res, 404, "Project not found.");

  ["name", "description", "color", "status"].forEach((field) => {
    if (req.body[field] !== undefined) project[field] = req.body[field];
  });
  await ctx.workspace.save();

  res.json({ success: true, project });
});

// ---------------------------------------------------------------------------
// Team tasks
// ---------------------------------------------------------------------------

/** POST /api/workspaces/:workspaceId/tasks */
const createTeamTask = asyncHandler(async (req, res) => {
  if (!requireDatabase(res)) return;

  const ctx = await loadWorkspace(req, res, "task.create");
  if (!ctx) return;

  const body = req.body || {};
  const title = String(body.title || "").trim();
  if (!title) return fail(res, 400, "Task title is required.");

  if (body.projectId && !ctx.workspace.projects.id(body.projectId)) {
    return fail(res, 400, "Project not found in this workspace.");
  }

  const assignedTo = await buildAssignees(ctx.workspace, body.assigneeIds);

  const task = await Task.create({
    creatorId: req.user.id,
    workspaceId: ctx.workspace._id,
    projectId: body.projectId || null,
    title,
    description: String(body.description || "").trim(),
    status: BOARD_STATUSES.includes(body.status) ? body.status : "todo",
    priority: body.priority || "medium",
    category: body.category || "content",
    tags: Array.isArray(body.tags) ? body.tags : [],
    startDate: body.startDate ? new Date(body.startDate) : undefined,
    dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
    estimatedHours: Number(body.estimatedHours) || 0,
    visibility: ["workspace", "private"].includes(body.visibility) ? body.visibility : "workspace",
    subtasks: Array.isArray(body.subtasks)
      ? body.subtasks.filter((s) => s && s.title).map((s) => ({ title: String(s.title), completed: false }))
      : [],
    assignedTo,
    recurring: collab.sanitizeRecurrence(body.recurring) || undefined,
    activity: [{ actorId: req.user.id, type: "created" }],
  });

  // Generate upcoming occurrences now rather than waiting for the hourly run.
  if (task.recurring && task.recurring.isRecurring) {
    await collab.materializeOccurrences(task.toObject());
  }

  await collab.notifyUsers(task.assigneeIds, req.user.id, {
    title: `📌 Assigned: ${task.title}`,
    message: `You were assigned to "${task.title}".`,
    dedupeKey: `task_assigned_${task._id}`,
    taskId: task._id,
  });

  res.status(201).json({ success: true, task });
});

/**
 * PATCH /api/tasks/:id/team - update a task with workspace permissions.
 * Participants may move and edit their tasks; reassigning, re-scoping and
 * changing visibility need owner/admin rights or task authorship.
 */
const updateTeamTask = asyncHandler(async (req, res) => {
  if (!requireDatabase(res)) return;

  const ctx = await loadTask(req, res, "task.update.any");
  if (!ctx) return;

  const { task } = ctx;
  const body = req.body || {};
  const before = task.toObject();
  const changes = {};

  if (body.status !== undefined) {
    if (!BOARD_STATUSES.includes(body.status)) return fail(res, 400, "Invalid status.");
    changes.status = body.status;
  }
  ["title", "description", "priority", "dueDate"].forEach((field) => {
    if (body[field] !== undefined) changes[field] = body[field];
  });
  if (Number.isFinite(Number(body.boardOrder))) changes.boardOrder = Number(body.boardOrder);

  const restricted = ["assigneeIds", "projectId", "visibility", "recurring"].filter((f) => body[f] !== undefined);
  if (restricted.length && !canModerate(ctx, req.user.id)) {
    return fail(res, 403, "Only admins or the task author can reassign, re-scope or repeat a task.");
  }

  let repeatChanged = false;
  if (body.recurring !== undefined) {
    // Occurrences belong to their parent's series and never repeat themselves.
    if (task.seriesId) return fail(res, 400, "Change the repeat rule on the original task instead.");
    const rule = collab.sanitizeRecurrence(body.recurring);
    const was = task.recurring && task.recurring.isRecurring ? task.recurring.frequency : "none";
    const now = rule ? rule.frequency : "none";
    // Keep the generation high-water mark so past occurrences are not recreated.
    changes.recurring = rule
      ? { ...rule, generatedCount: task.recurring?.generatedCount || 0, lastGeneratedFor: task.recurring?.lastGeneratedFor }
      : { isRecurring: false };
    if (was !== now) {
      repeatChanged = true;
      task.activity.push({ actorId: req.user.id, type: "repeat_changed", from: was, to: now });
    }
  }

  if (body.projectId !== undefined) {
    if (body.projectId && !(ctx.workspace && (ctx.workspace.projects || []).some((p) => sameId(p._id, body.projectId)))) {
      return fail(res, 400, "Project not found in this workspace.");
    }
    changes.projectId = body.projectId || null;
  }
  if (body.visibility !== undefined) {
    if (!["workspace", "private"].includes(body.visibility)) return fail(res, 400, "Invalid visibility.");
    changes.visibility = body.visibility;
  }
  if (body.assigneeIds !== undefined) {
    changes.assignedTo = await buildAssignees(ctx.workspace, body.assigneeIds);
  }

  task.set(changes);
  await task.validate();

  const after = { ...changes };
  if (changes.assignedTo) after.assigneeIds = changes.assignedTo.map((a) => a.userId);
  Task.diffActivity(before, after, req.user.id).forEach((entry) => task.activity.push(entry));
  task.lastActivityAt = new Date();
  await task.save();

  if (repeatChanged && task.recurring.isRecurring) {
    await collab.materializeOccurrences(task.toObject());
  }

  const added = (task.assigneeIds || []).filter(
    (id) => !(before.assigneeIds || []).some((prev) => sameId(prev, id))
  );
  await collab.notifyUsers(added, req.user.id, {
    title: `📌 Assigned: ${task.title}`,
    message: `You were assigned to "${task.title}".`,
    dedupeKey: `task_assigned_${task._id}`,
    taskId: task._id,
  });

  if (changes.status && changes.status !== before.status) {
    await collab.notifyUsers(
      [task.creatorId, ...(task.watchers || []), ...(task.assigneeIds || [])],
      req.user.id,
      {
        title: `🔄 ${task.title}`,
        message: `Status changed to "${changes.status}".`,
        dedupeKey: `task_status_${task._id}_${changes.status}`,
        taskId: task._id,
      }
    );
  }

  res.json({ success: true, task });
});

// ---------------------------------------------------------------------------
// Views: list, board, calendar, workload
// ---------------------------------------------------------------------------

/** Base scope: a workspace the caller belongs to, or their personal tasks. */
function buildScope(req, ctx) {
  const userId = toObjectId(req.user.id);
  if (!ctx) return { creatorId: userId };

  const scope = { workspaceId: ctx.workspace._id };
  if (!["owner", "admin"].includes(ctx.role)) {
    scope.$or = [
      { visibility: { $ne: "private" } },
      { creatorId: userId },
      { assigneeIds: userId },
      { watchers: userId },
    ];
  }
  return scope;
}

function applyFilters(query, params) {
  query.isArchived = params.isArchived === "true";

  ["status", "priority", "category"].forEach((field) => {
    if (params[field]) query[field] = { $in: String(params[field]).split(",") };
  });
  if (params.tag) query.tags = params.tag;
  if (isValidId(params.projectId)) query.projectId = toObjectId(params.projectId);
  if (isValidId(params.assigneeId)) query.assigneeIds = toObjectId(params.assigneeId);

  if (params.search) {
    const term = { $regex: escapeRegex(String(params.search)), $options: "i" };
    // $and keeps the visibility $or intact alongside the search $or.
    query.$and = [{ $or: [{ title: term }, { description: term }, { tags: term }] }];
  }

  return query;
}

async function listView(req, res, scope) {
  const limit = Math.min(Number(req.query.limit) || PAGE_SIZE, MAX_PAGE_SIZE);
  // Cursor pagination needs a field every task has; dueDate can be empty, and
  // tasks without one would silently fall out of the paging.
  const sortField = "createdAt";
  const dir = req.query.order === "asc" ? 1 : -1;
  const query = applyFilters(scope, req.query);

  if (req.query.cursor) {
    // The _id tie-break stops rows with equal sort values being skipped or repeated.
    const [value, id] = String(req.query.cursor).split("|");
    const op = dir === 1 ? "$gt" : "$lt";
    if (isValidId(id)) {
      query.$and = (query.$and || []).concat({
        $or: [
          { [sortField]: { [op]: new Date(value) } },
          { [sortField]: new Date(value), _id: { [op]: toObjectId(id) } },
        ],
      });
    }
  }

  const rows = await Task.find(query)
    .select("-comments -activity")
    .sort({ [sortField]: dir, _id: dir })
    .limit(limit + 1)
    .lean();

  const hasMore = rows.length > limit;
  const tasks = hasMore ? rows.slice(0, limit) : rows;
  const last = tasks[tasks.length - 1];

  res.json({
    success: true,
    tasks,
    hasMore,
    nextCursor: hasMore ? `${new Date(last[sortField]).toISOString()}|${last._id}` : null,
  });
}

async function boardView(req, res, scope) {
  const query = applyFilters(scope, { ...req.query, status: undefined });
  const limit = Math.min(Number(req.query.columnLimit) || BOARD_COLUMN_LIMIT, MAX_PAGE_SIZE);

  // Each column is capped so a large project never returns thousands of cards.
  const [columns, totals] = await Promise.all([
    Promise.all(
      BOARD_STATUSES.map(async (status) => [
        status,
        await Task.find({ ...query, status })
          .select("-comments -activity")
          .sort({ boardOrder: 1, createdAt: -1 })
          .limit(limit)
          .lean(),
      ])
    ),
    Task.aggregate([{ $match: query }, { $group: { _id: "$status", total: { $sum: 1 } } }]),
  ]);

  res.json({
    success: true,
    columns: Object.fromEntries(columns),
    totals: Object.fromEntries(totals.map((t) => [t._id, t.total])),
  });
}

async function calendarView(req, res, scope) {
  const start = new Date(req.query.start);
  const end = new Date(req.query.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return fail(res, 400, "Valid start and end dates are required.");
  }

  const query = applyFilters(scope, req.query);
  query.dueDate = { $gte: start, $lte: end };

  const tasks = await Task.find(query)
    .select("title status priority dueDate startDate projectId seriesId recurring.isRecurring")
    .limit(1000)
    .lean();

  res.json({ success: true, tasks });
}

async function workloadView(req, res, scope) {
  const query = applyFilters(scope, req.query);
  if (!query.status) query.status = { $nin: ["completed", "cancelled"] };

  // Aggregated in MongoDB so the payload stays small regardless of task count.
  const rows = await Task.aggregate([
    { $match: query },
    { $unwind: { path: "$assigneeIds", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: "$assigneeIds",
        taskCount: { $sum: 1 },
        estimatedHours: { $sum: { $ifNull: ["$estimatedHours", 0] } },
        overdue: {
          $sum: { $cond: [{ $and: [{ $gt: ["$dueDate", null] }, { $lt: ["$dueDate", new Date()] }] }, 1, 0] },
        },
      },
    },
    { $sort: { estimatedHours: -1 } },
    { $limit: 100 },
  ]);

  const assigned = rows.filter((r) => r._id);
  const users = await User.find({ _id: { $in: assigned.map((r) => r._id) } })
    .select("name email")
    .lean();

  res.json({
    success: true,
    workload: assigned.map(({ _id, ...stats }) => ({
      user: users.find((u) => sameId(u._id, _id)) || { _id },
      ...stats,
    })),
    unassigned: rows.find((r) => !r._id) || null,
  });
}

const VIEWS = { list: listView, board: boardView, calendar: calendarView, workload: workloadView };

/** GET /api/tasks/views/:view - add ?workspaceId= for a team view. */
const getView = asyncHandler(async (req, res) => {
  const render = VIEWS[req.params.view];
  if (!render) return fail(res, 404, "Unknown view.");
  if (isMockMode()) return res.json({ success: true, tasks: [], columns: {}, workload: [] });

  let ctx = null;
  if (req.query.workspaceId) {
    ctx = await loadWorkspace(req, res, "task.view");
    if (!ctx) return;
  }

  return render(req, res, buildScope(req, ctx));
});

// ---------------------------------------------------------------------------
// Task details: comments, activity, links, dependencies, watchers
// ---------------------------------------------------------------------------

/** GET /api/tasks/:id/details */
const getTaskDetails = asyncHandler(async (req, res) => {
  if (!requireDatabase(res)) return;

  const ctx = await loadTask(req, res);
  if (!ctx) return;

  await ctx.task.populate([
    { path: "comments.authorId", select: "name email" },
    { path: "comments.mentions", select: "name email" },
    { path: "activity.actorId", select: "name email" },
    { path: "dependencies", select: "title status" },
  ]);

  const task = ctx.task.toObject();
  task.comments = task.comments.filter((c) => !c.deletedAt);

  res.json({
    success: true,
    role: ctx.role,
    canModerate: canModerate(ctx, req.user.id),
    watching: task.watchers.some((w) => sameId(w, req.user.id)),
    projects: ctx.workspace ? ctx.workspace.projects.map((p) => ({ _id: p._id, name: p.name })) : [],
    members: ctx.workspace
      ? await User.find({ _id: { $in: [...memberIds(ctx.workspace)] } }).select("name email").lean()
      : [],
    task,
  });
});

const SAFE_URL = /^(\/(?!\/)|https?:\/\/)/i;

/** POST /api/tasks/:id/comments */
const addComment = asyncHandler(async (req, res) => {
  if (!requireDatabase(res)) return;

  const ctx = await loadTask(req, res, "comment.create");
  if (!ctx) return;

  const body = String((req.body && req.body.body) || "").trim();
  if (!body) return fail(res, 400, "Comment body is required.");
  if (body.length > 5000) return fail(res, 400, "Comments are limited to 5000 characters.");

  // Mentions are limited to workspace members so comments cannot notify anyone else.
  const allowed = memberIds(ctx.workspace);
  const mentions = [...new Set((req.body.mentions || []).map(String))].filter((id) => allowed.has(id));

  // Only relative or http(s) URLs, so a javascript: link can never be stored.
  const attachments = (req.body.attachments || [])
    .filter((a) => a && a.name && SAFE_URL.test(String(a.url || "")))
    .slice(0, 10)
    .map((a) => ({ name: String(a.name).slice(0, 255), url: String(a.url) }));

  const { task } = ctx;
  task.comments.push({ authorId: req.user.id, body, mentions, attachments });
  recordActivity(task, req.user.id, "commented");
  await task.save();

  await collab.notifyUsers(mentions, req.user.id, {
    title: `💬 You were mentioned: ${task.title}`,
    message: body.slice(0, 140),
    taskId: task._id,
  });
  // Mentioned users already have a notification for this comment.
  await collab.notifyUsers(
    [task.creatorId, ...(task.assigneeIds || []), ...(task.watchers || [])].filter(
      (id) => !mentions.includes(String(id))
    ),
    req.user.id,
    {
      title: `💬 New comment: ${task.title}`,
      message: body.slice(0, 140),
      dedupeKey: `task_comment_${task._id}`,
      taskId: task._id,
    }
  );

  res.status(201).json({ success: true, comment: task.comments[task.comments.length - 1] });
});

/** DELETE /api/tasks/:id/comments/:commentId - soft delete. */
const deleteComment = asyncHandler(async (req, res) => {
  if (!requireDatabase(res)) return;

  const ctx = await loadTask(req, res);
  if (!ctx) return;

  const comment = ctx.task.comments.id(req.params.commentId);
  if (!comment || comment.deletedAt) return fail(res, 404, "Comment not found.");

  const isAuthor = sameId(comment.authorId, req.user.id);
  if (!isAuthor && !["owner", "admin"].includes(ctx.role)) {
    return fail(res, 403, "You cannot delete this comment.");
  }

  comment.deletedAt = new Date();
  await ctx.task.save();

  res.json({ success: true });
});

/** POST /api/tasks/:id/links - link to a CRM deal, content piece, campaign, etc. */
const addLink = asyncHandler(async (req, res) => {
  if (!requireDatabase(res)) return;

  const ctx = await loadTask(req, res, "task.update.any");
  if (!ctx) return;

  const { module, refId } = req.body || {};
  const { link, error } = await collab.resolveLink(module, refId, [ctx.task.creatorId, req.user.id]);
  if (error) return fail(res, 400, error);

  if (ctx.task.links.some((l) => l.module === module && sameId(l.refId, refId))) {
    return fail(res, 409, "That record is already linked.");
  }

  ctx.task.links.push({ ...link, addedBy: req.user.id });
  recordActivity(ctx.task, req.user.id, "linked", { to: `${module}:${link.label}` });
  await ctx.task.save();

  res.status(201).json({ success: true, links: ctx.task.links });
});

/**
 * GET /api/tasks/link-options?module=&search= - the caller's own records.
 * Only your own, so teammates cannot browse each other's CRM or content.
 */
const getLinkOptions = asyncHandler(async (req, res) => {
  if (isMockMode()) return res.json({ success: true, options: [] });
  if (!collab.LINK_TARGETS[req.query.module]) return fail(res, 400, "Unsupported link type.");

  res.json({
    success: true,
    options: await collab.listLinkOptions(req.query.module, req.user.id, req.query.search),
  });
});

/** DELETE /api/tasks/:id/links/:linkId */
const removeLink = asyncHandler(async (req, res) => {
  if (!requireDatabase(res)) return;

  const ctx = await loadTask(req, res, "task.update.any");
  if (!ctx) return;

  const link = ctx.task.links.id(req.params.linkId);
  if (!link) return fail(res, 404, "Link not found.");

  link.deleteOne();
  recordActivity(ctx.task, req.user.id, "unlinked", { from: `${link.module}:${link.label}` });
  await ctx.task.save();

  res.json({ success: true, links: ctx.task.links });
});

/** POST /api/tasks/:id/dependencies - declare a prerequisite task. */
const addDependency = asyncHandler(async (req, res) => {
  if (!requireDatabase(res)) return;

  const ctx = await loadTask(req, res, "task.update.any");
  if (!ctx) return;

  const { task } = ctx;
  const { dependsOnId } = req.body || {};

  if (!isValidId(dependsOnId)) return fail(res, 400, "Invalid dependency id.");
  if (sameId(task._id, dependsOnId)) return fail(res, 400, "A task cannot depend on itself.");

  // Same scope only, so a dependency cannot expose another creator's task.
  const dependency = await Task.findById(dependsOnId).select("title creatorId workspaceId").lean();
  const sameScope = dependency && (task.workspaceId
    ? sameId(dependency.workspaceId, task.workspaceId)
    : !dependency.workspaceId && sameId(dependency.creatorId, task.creatorId));
  if (!sameScope) return fail(res, 404, "Dependency task not found.");

  if (task.dependencies.some((d) => sameId(d, dependsOnId))) {
    return fail(res, 409, "That dependency already exists.");
  }
  if (await collab.wouldCreateCycle(task._id, dependsOnId)) {
    return fail(res, 400, "That dependency would create a circular chain.");
  }

  task.dependencies.push(dependsOnId);
  recordActivity(task, req.user.id, "dependency_added", { to: dependency.title });
  await task.save();

  res.status(201).json({ success: true, dependencies: task.dependencies });
});

/** DELETE /api/tasks/:id/dependencies/:dependencyId */
const removeDependency = asyncHandler(async (req, res) => {
  if (!requireDatabase(res)) return;

  const ctx = await loadTask(req, res, "task.update.any");
  if (!ctx) return;

  const before = ctx.task.dependencies.length;
  ctx.task.dependencies = ctx.task.dependencies.filter((d) => !sameId(d, req.params.dependencyId));
  if (ctx.task.dependencies.length === before) return fail(res, 404, "Dependency not found.");

  recordActivity(ctx.task, req.user.id, "dependency_removed");
  await ctx.task.save();

  res.json({ success: true, dependencies: ctx.task.dependencies });
});

/** POST /api/tasks/:id/watch - toggle following a task. */
const toggleWatch = asyncHandler(async (req, res) => {
  if (!requireDatabase(res)) return;

  const ctx = await loadTask(req, res);
  if (!ctx) return;

  const watching = ctx.task.watchers.some((w) => sameId(w, req.user.id));
  ctx.task.watchers = watching
    ? ctx.task.watchers.filter((w) => !sameId(w, req.user.id))
    : [...ctx.task.watchers, req.user.id];
  await ctx.task.save();

  res.json({ success: true, watching: !watching });
});

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

/** GET /api/task-templates */
const listTemplates = (req, res) => {
  res.json({
    success: true,
    templates: Object.entries(collab.TEMPLATES).map(([key, t]) => ({
      key,
      name: t.name,
      icon: t.icon,
      category: t.task.category,
      steps: t.subtasks.map(([title]) => title),
    })),
  });
};

/** POST /api/task-templates/:key/apply - optional workspaceId and projectId. */
const applyTemplate = asyncHandler(async (req, res) => {
  if (!requireDatabase(res)) return;

  const startDate = req.body && req.body.startDate ? new Date(req.body.startDate) : new Date();
  if (Number.isNaN(startDate.getTime())) return fail(res, 400, "Invalid start date.");

  const fields = collab.buildTaskFromTemplate(req.params.key, startDate);
  if (!fields) return fail(res, 404, "Template not found.");

  let ctx = null;
  if (req.body && req.body.workspaceId) {
    ctx = await loadWorkspace(req, res, "task.create");
    if (!ctx) return;
    if (req.body.projectId && !ctx.workspace.projects.id(req.body.projectId)) {
      return fail(res, 400, "Project not found in this workspace.");
    }
  }

  const task = await Task.create({
    ...fields,
    creatorId: req.user.id,
    workspaceId: ctx ? ctx.workspace._id : undefined,
    projectId: ctx && req.body.projectId ? req.body.projectId : null,
    activity: [{ actorId: req.user.id, type: "created", to: `template:${req.params.key}` }],
  });

  res.status(201).json({ success: true, task });
});

module.exports = {
  listWorkspaces,
  createWorkspace,
  getWorkspace,
  addMember,
  removeMember,
  createProject,
  updateProject,
  createTeamTask,
  updateTeamTask,
  getView,
  getTaskDetails,
  addComment,
  deleteComment,
  addLink,
  getLinkOptions,
  removeLink,
  addDependency,
  removeDependency,
  toggleWatch,
  listTemplates,
  applyTemplate,
};
