const mongoose = require("mongoose");
const cron = require("node-cron");
const Task = require("../model/task");
const smartNotificationService = require("./smartNotificationService");
const escapeRegex = require("../utils/escapeRegex");

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// How far ahead copies of a repeating task are created. Kept short so a daily
// or weekly task does not flood the board; the hourly run extends it over time.
const RECURRENCE_HORIZON_DAYS = 14;
const MAX_OCCURRENCES_PER_RUN = 200;
const MAX_GRAPH_TRAVERSAL = 500;

const sameId = (a, b) => Boolean(a) && Boolean(b) && String(a) === String(b);

// ---------------------------------------------------------------------------
// Permissions. Pure: callers load the documents and pass them in.
// ---------------------------------------------------------------------------

const ROLE_ORDER = ["owner", "admin", "member", "guest"];

const ROLE_CAPABILITIES = {
  owner: [
    "workspace.manage",
    "workspace.invite",
    "project.manage",
    "task.view",
    "task.create",
    "task.update.any",
    "task.update.assigned",
    "task.delete.any",
    "comment.create",
  ],
  admin: [
    "workspace.invite",
    "project.manage",
    "task.view",
    "task.create",
    "task.update.any",
    "task.update.assigned",
    "task.delete.any",
    "comment.create",
  ],
  member: ["task.view", "task.create", "task.update.assigned", "comment.create"],
  guest: ["task.view", "task.update.assigned", "comment.create"],
};

function roleCan(role, capability) {
  return Boolean(role) && (ROLE_CAPABILITIES[role] || []).includes(capability);
}

/** Workspace role for a user, or null when not a member. */
function resolveWorkspaceRole(workspace, userId) {
  if (!workspace || !userId) return null;
  if (sameId(workspace.ownerId, userId)) return "owner";

  const member = (workspace.members || []).find((m) => sameId(m.userId, userId));
  return member ? member.role : null;
}

/** Project overrides can lower a member's access but never raise it. */
function resolveProjectRole(workspace, project, userId) {
  const workspaceRole = resolveWorkspaceRole(workspace, userId);
  if (!workspaceRole || workspaceRole === "owner" || !project) return workspaceRole;

  const override = (project.memberOverrides || []).find((m) => sameId(m.userId, userId));
  if (!override) return workspaceRole;

  return ROLE_ORDER.indexOf(override.role) < ROLE_ORDER.indexOf(workspaceRole)
    ? workspaceRole
    : override.role;
}

/** Creator, assignee or watcher. */
function isTaskParticipant(task, userId) {
  if (!task || !userId) return false;
  if (sameId(task.creatorId, userId)) return true;
  if ((task.assigneeIds || []).some((id) => sameId(id, userId))) return true;
  if ((task.assignedTo || []).some((a) => sameId(a && a.userId, userId))) return true;
  return (task.watchers || []).some((id) => sameId(id, userId));
}

/**
 * Task-level access. Private tasks are limited to participants, even for
 * workspace owners and admins. Personal tasks (no workspace) are creator-only.
 */
function canAccessTask(capability, { role, userId, task }) {
  if (!task) return false;
  if (!task.workspaceId) return sameId(task.creatorId, userId);

  const participant = isTaskParticipant(task, userId);
  if (task.visibility === "private" && !participant) return false;

  if (capability === "task.update.any") {
    return (
      roleCan(role, "task.update.any") ||
      (participant && roleCan(role, "task.update.assigned"))
    );
  }

  if (capability === "task.delete.any") {
    return roleCan(role, "task.delete.any") || sameId(task.creatorId, userId);
  }

  return roleCan(role, capability);
}

// ---------------------------------------------------------------------------
// Recurrence. Date maths is pure; generation relies on the unique
// {seriesId, occurrenceKey} index on Task to make duplicates impossible.
// ---------------------------------------------------------------------------

function addDays(date, count) {
  return new Date(date.getTime() + count * MS_PER_DAY);
}

/** Adds months, clamping to the last valid day (Jan 31 + 1m -> Feb 28/29). */
function addMonths(date, count) {
  const d = new Date(date);
  const day = d.getUTCDate();

  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + count);

  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/** YYYY-MM-DD in the rule's timezone; falls back to UTC for unknown zones. */
function occurrenceKeyFor(date, timezone) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(date));
  } catch (err) {
    return new Date(date).toISOString().slice(0, 10);
  }
}

/**
 * The index-th occurrence from the anchor. Computing from the anchor rather
 * than stepping avoids drift: monthly on the 31st gives Feb 28 then Mar 31.
 */
function occurrenceAt(anchor, frequency, interval, index) {
  const n = Math.max(1, Number(interval) || 1) * index;

  switch (frequency) {
    case "daily":
    case "custom":
      return addDays(anchor, n);
    case "monthly":
      return addMonths(anchor, n);
    case "yearly":
      return addMonths(anchor, n * 12);
    default:
      return addDays(anchor, n * 7);
  }
}

/** Occurrence dates a rule produces in (after, until]. */
function computeOccurrences(recurrence = {}, options = {}) {
  const {
    frequency = "weekly",
    interval = 1,
    byWeekday = [],
    endDate,
    maxOccurrences,
    generatedCount = 0,
  } = recurrence;

  const anchor = options.anchor ? new Date(options.anchor) : null;
  if (!anchor || Number.isNaN(anchor.getTime())) return [];

  const after = options.after ? new Date(options.after) : null;
  const until = options.until
    ? new Date(options.until)
    : addDays(new Date(), RECURRENCE_HORIZON_DAYS);
  const stopAt = endDate ? new Date(endDate) : null;
  const limit = Math.min(Number(options.limit) || MAX_OCCURRENCES_PER_RUN, MAX_OCCURRENCES_PER_RUN);
  const budget = Number.isFinite(maxOccurrences)
    ? Math.max(0, maxOccurrences - generatedCount)
    : Infinity;
  const cap = Math.min(limit, budget);
  if (cap === 0) return [];

  const weekdays = [
    ...new Set((byWeekday || []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)),
  ].sort();

  const base = new Date(anchor);
  base.setUTCHours(0, 0, 0, 0);

  const results = [];
  const inRange = (date) =>
    date <= until && (!stopAt || date <= stopAt) && (!after || date > after);

  // The index bound is a safety net independent of the date maths.
  for (let index = 0; index <= 5000 && results.length < cap; index += 1) {
    const cursor = occurrenceAt(base, frequency, interval, index);
    if (cursor > until || (stopAt && cursor > stopAt)) break;

    if (frequency === "weekly" && weekdays.length) {
      const weekStart = addDays(cursor, -cursor.getUTCDay());
      for (const weekday of weekdays) {
        const candidate = addDays(weekStart, weekday);
        if (candidate >= cursor && inRange(candidate) && results.length < cap) {
          results.push(candidate);
        }
      }
    } else if (!after || cursor > after) {
      results.push(cursor);
    }
  }

  return results.sort((a, b) => a - b).slice(0, cap);
}

const FREQUENCIES = ["daily", "weekly", "monthly", "yearly"];

/** Whitelist a repeat rule from user input; null means "does not repeat". */
function sanitizeRecurrence(input) {
  if (!input || !FREQUENCIES.includes(input.frequency)) return null;

  const rule = {
    isRecurring: true,
    frequency: input.frequency,
    interval: Math.min(Math.max(parseInt(input.interval, 10) || 1, 1), 365),
    timezone: typeof input.timezone === "string" ? input.timezone.slice(0, 64) : "UTC",
  };

  const weekdays = (input.byWeekday || []).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  if (rule.frequency === "weekly" && weekdays.length) rule.byWeekday = [...new Set(weekdays)];

  const end = input.endDate ? new Date(input.endDate) : null;
  if (end && !Number.isNaN(end.getTime())) rule.endDate = end;

  const max = parseInt(input.maxOccurrences, 10);
  if (max > 0) rule.maxOccurrences = Math.min(max, 1000);

  return rule;
}

/**
 * Create pending occurrences for one recurring parent. The parent is itself
 * the first occurrence, so generation starts after its own date. Every write is
 * an upsert on {seriesId, occurrenceKey}, so re-running - concurrently, after a
 * retry or after a restart - creates nothing new.
 */
async function materializeOccurrences(parent, options = {}) {
  const empty = { created: 0, skipped: 0 };
  if (!parent || !parent.recurring || !parent.recurring.isRecurring) return empty;

  const rule = parent.recurring;
  const seriesId = parent._id;
  const anchor = parent.dueDate || parent.startDate || parent.createdAt || new Date();
  const occurrences = computeOccurrences(
    // +1: the parent counts towards maxOccurrences.
    { ...rule, generatedCount: (rule.generatedCount || 0) + 1 },
    {
      anchor,
      after: rule.lastGeneratedFor || anchor,
      until: options.until,
      limit: options.limit,
    }
  );
  if (!occurrences.length) return empty;

  let created = 0;
  let skipped = 0;
  let lastGenerated = rule.lastGeneratedFor || null;

  for (const dueDate of occurrences) {
    const occurrenceKey = occurrenceKeyFor(dueDate, rule.timezone);

    try {
      const result = await Task.updateOne(
        { seriesId, occurrenceKey },
        {
          $setOnInsert: {
            creatorId: parent.creatorId,
            workspaceId: parent.workspaceId,
            projectId: parent.projectId || null,
            title: parent.title,
            description: parent.description || "",
            status: "todo",
            priority: parent.priority,
            category: parent.category,
            tags: parent.tags || [],
            assignedTo: parent.assignedTo || [],
            assigneeIds: parent.assigneeIds || [],
            watchers: parent.watchers || [],
            visibility: parent.visibility || "workspace",
            estimatedHours: parent.estimatedHours || 0,
            subtasks: (parent.subtasks || []).map((s) => ({ title: s.title, completed: false })),
            dueDate,
            seriesId,
            occurrenceKey,
            activity: [{ type: "recurrence_generated", to: occurrenceKey }],
            lastActivityAt: new Date(),
          },
        },
        { upsert: true }
      );

      if (result.upsertedCount) created += 1;
      else skipped += 1;
    } catch (err) {
      // A concurrent run won the race on the unique index: that is the
      // duplicate protection working, not a failure.
      if (err && err.code === 11000) skipped += 1;
      else throw err;
    }

    if (!lastGenerated || dueDate > lastGenerated) lastGenerated = dueDate;
  }

  await Task.updateOne(
    { _id: parent._id },
    {
      $set: { "recurring.lastGeneratedFor": lastGenerated },
      $inc: { "recurring.generatedCount": created },
    }
  );

  return { created, skipped };
}

/** Generate upcoming occurrences for every active recurring parent. */
async function generateDueRecurrences(options = {}) {
  if (mongoose.connection.readyState !== 1) return { parents: 0, created: 0 };

  // Occurrences carry a seriesId, so they are never treated as parents.
  const parents = await Task.find({
    "recurring.isRecurring": true,
    isArchived: false,
    seriesId: { $exists: false },
  }).lean();

  let created = 0;
  for (const parent of parents) {
    created += (await materializeOccurrences(parent, options)).created;
  }

  return { parents: parents.length, created };
}

/** Hourly: generation covers a rolling horizon, so a missed tick is harmless. */
function startRecurrenceWorker() {
  if (process.env.NODE_ENV === "test" || process.env.USE_MOCK_DB === "true") return;

  let running = false;
  cron.schedule("0 * * * *", async () => {
    if (running) return;
    running = true;
    try {
      await generateDueRecurrences();
    } catch (err) {
      console.error("[TaskRecurrence] Generation failed:", err.message);
    } finally {
      running = false;
    }
  });
}

// ---------------------------------------------------------------------------
// Dependencies.
// ---------------------------------------------------------------------------

/**
 * Adding "taskId depends on candidateId" closes a cycle when taskId is already
 * reachable upward from candidateId. Breadth-first and bounded.
 */
async function wouldCreateCycle(taskId, candidateId) {
  if (sameId(taskId, candidateId)) return true;

  const seen = new Set([String(candidateId)]);
  let frontier = [candidateId];
  let visited = 0;

  while (frontier.length && visited < MAX_GRAPH_TRAVERSAL) {
    const tasks = await Task.find({ _id: { $in: frontier } }).select("dependencies").lean();
    const next = [];

    for (const task of tasks) {
      visited += 1;
      for (const dep of task.dependencies || []) {
        if (sameId(dep, taskId)) return true;
        if (!seen.has(String(dep))) {
          seen.add(String(dep));
          next.push(dep);
        }
      }
    }

    frontier = next;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Links to other CreatorOS modules.
// ---------------------------------------------------------------------------

// Owner and label field names differ between modules, so each is explicit.
const LINK_TARGETS = {
  crm_deal: { model: "CrmDeal", path: "../model/crmDeal", owner: "creatorId", label: "dealName" },
  crm_brand: { model: "CrmBrand", path: "../model/crmBrand", owner: "creatorId", label: "companyName" },
  crm_invoice: { model: "CrmInvoice", path: "../model/crmInvoice", owner: "creatorId", label: "invoiceNumber" },
  content_os: { model: "ContentOs", path: "../model/contentOs", owner: "userId", label: "title" },
  scheduled_content: { model: "ScheduledContent", path: "../model/scheduledContent", owner: "userId", label: "caption" },
  url: { model: "Url", path: "../model/url", owner: "userId", label: "shortId" },
  meeting: { model: "MeetingBooking", path: "../model/meetingBooking", owner: "userId", label: "attendeeName" },
  vault_file: { model: "VaultFile", path: "../model/vaultFile", owner: "userId", label: "originalName" },
};

function linkModel(module) {
  const target = LINK_TARGETS[module];
  if (!target) return null;
  if (mongoose.models[target.model]) return mongoose.models[target.model];
  try {
    return require(target.path);
  } catch (err) {
    return null;
  }
}

/**
 * Validate a link target and derive its label. The record must belong to one
 * of `ownerIds` (the task creator or the person linking it); anything else,
 * including a missing owner, reads as "not found" so ids cannot be probed.
 */
async function resolveLink(module, refId, ownerIds) {
  const target = LINK_TARGETS[module];
  if (!target) return { error: `Unsupported link type "${module}".` };
  if (!mongoose.Types.ObjectId.isValid(refId)) return { error: "Invalid record id." };

  const Model = linkModel(module);
  if (!Model) return { error: "That module is unavailable." };

  const record = await Model.findById(refId).lean();
  if (!record || ![].concat(ownerIds).some((id) => sameId(record[target.owner], id))) {
    return { error: "Linked record not found." };
  }

  return {
    link: {
      module,
      refId: record._id,
      label: String(record[target.label] || "Untitled").slice(0, 120),
    },
  };
}

/** A user's own records in a module, for the link picker. */
async function listLinkOptions(module, ownerId, search = "") {
  const target = LINK_TARGETS[module];
  const Model = target && linkModel(module);
  if (!Model) return [];

  const query = { [target.owner]: ownerId };
  const term = String(search).trim();
  if (term) {
    query[target.label] = { $regex: escapeRegex(term.slice(0, 100)), $options: "i" };
  }

  const records = await Model.find(query)
    .select(target.label)
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  return records.map((r) => ({ _id: r._id, label: String(r[target.label] || "Untitled").slice(0, 120) }));
}

// ---------------------------------------------------------------------------
// Built-in templates. Kept in code: they are product content, not user data.
// Offsets are days relative to the start date chosen when applying.
// ---------------------------------------------------------------------------

const TEMPLATES = {
  content_production: {
    name: "Content Production",
    icon: "🎬",
    task: { title: "New content piece", category: "content", priority: "medium", estimatedHours: 8, dueOffsetDays: 7 },
    subtasks: [
      ["Research topic and hook", 1],
      ["Write script or outline", 2],
      ["Record footage", 3],
      ["Edit video", 5],
      ["Design thumbnail", 6],
      ["Write title, description and tags", 6],
      ["Schedule and publish", 7],
    ],
  },
  sponsorship_delivery: {
    name: "Sponsorship Delivery",
    icon: "🤝",
    task: { title: "Sponsorship deliverable", category: "sponsorship", priority: "high", estimatedHours: 6, dueOffsetDays: 14 },
    subtasks: [
      ["Confirm deliverables and deadlines", 1],
      ["Review brand brief", 2],
      ["Produce sponsored segment", 7],
      ["Send draft for brand approval", 9],
      ["Apply revisions", 11],
      ["Publish and capture proof", 13],
      ["Send invoice", 14],
    ],
  },
  product_launch: {
    name: "Product Launch",
    icon: "🚀",
    task: { title: "Product launch", category: "growth", priority: "urgent", estimatedHours: 20, dueOffsetDays: 30 },
    subtasks: [
      ["Define offer and pricing", 3],
      ["Build sales page", 10],
      ["Set up payment and delivery", 12],
      ["Plan launch content", 15],
      ["Tease the launch", 21],
      ["Launch day announcements", 28],
      ["Post-launch retrospective", 30],
    ],
  },
  client_onboarding: {
    name: "Client Onboarding",
    icon: "👋",
    task: { title: "Onboard new client", category: "admin", priority: "medium", estimatedHours: 4, dueOffsetDays: 10 },
    subtasks: [
      ["Send welcome pack and intake form", 1],
      ["Collect brand assets and access", 3],
      ["Sign contract and collect deposit", 5],
      ["Schedule kickoff call", 7],
      ["Add to CRM and set up project", 10],
    ],
  },
};

/** Task fields for a template, with offsets resolved against startDate. */
function buildTaskFromTemplate(key, startDate = new Date()) {
  const template = TEMPLATES[key];
  if (!template) return null;

  const offset = (days) => (Number.isFinite(days) ? addDays(startDate, days) : undefined);
  const { dueOffsetDays, ...fields } = template.task;

  return {
    ...fields,
    startDate,
    dueDate: offset(dueOffsetDays),
    templateKey: key,
    subtasks: template.subtasks.map(([title, days]) => ({
      title,
      completed: false,
      dueDate: offset(days),
    })),
  };
}

// ---------------------------------------------------------------------------
// Notifications.
// ---------------------------------------------------------------------------

/**
 * Notify each recipient once, skipping the actor. Delivery goes through
 * smartNotificationService, so channel, category and quiet-hour preferences
 * are honoured.
 */
async function notifyUsers(userIds, actorId, { title, message, dedupeKey, taskId }) {
  const recipients = [...new Set((userIds || []).filter(Boolean).map(String))].filter(
    (id) => !sameId(id, actorId)
  );

  for (const userId of recipients) {
    try {
      await smartNotificationService.sendNotification(userId, {
        title,
        message,
        category: "system",
        deduplicationKey: dedupeKey ? `${dedupeKey}_${userId}` : undefined,
        metadata: { taskId: String(taskId) },
      });
    } catch (err) {
      // A notification failure must never fail the task operation itself.
      console.error("[TaskCollab] Notification failed:", err.message);
    }
  }

  return recipients;
}

module.exports = {
  // permissions
  ROLE_CAPABILITIES,
  roleCan,
  resolveWorkspaceRole,
  resolveProjectRole,
  isTaskParticipant,
  canAccessTask,
  // recurrence
  sanitizeRecurrence,
  addMonths,
  occurrenceKeyFor,
  computeOccurrences,
  materializeOccurrences,
  generateDueRecurrences,
  startRecurrenceWorker,
  // dependencies, links, templates
  wouldCreateCycle,
  LINK_TARGETS,
  resolveLink,
  listLinkOptions,
  TEMPLATES,
  buildTaskFromTemplate,
  notifyUsers,
};
