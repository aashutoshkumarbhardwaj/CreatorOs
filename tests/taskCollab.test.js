jest.mock("../services/smartNotificationService", () => ({
  sendNotification: jest.fn().mockResolvedValue({}),
}));

const mongoose = require("mongoose");
const Task = require("../model/task");
const Workspace = require("../model/workspace");
const User = require("../model/user");
const smartNotificationService = require("../services/smartNotificationService");
const collab = require("../services/taskCollabService");
const controller = require("../controller/taskCollabController");

const d = (iso) => new Date(`${iso}T00:00:00.000Z`);
const keys = (dates) => dates.map((x) => x.toISOString().slice(0, 10));

/** Invoke an Express handler and surface errors passed to next(). */
async function call(handler, userId, req = {}) {
  const res = { statusCode: 200 };
  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((payload) => {
    res.body = payload;
    return res;
  });

  let error;
  await handler(
    { params: {}, query: {}, body: {}, ...req, user: { id: String(userId) } },
    res,
    (err) => {
      error = err;
    }
  );
  if (error) throw error;
  return res;
}

describe("Task collaboration", () => {
  let owner;
  let member;
  let guest;
  let outsider;
  let workspace;

  beforeAll(async () => {
    await Task.syncIndexes();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const stamp = Date.now() + Math.random();
    [owner, member, guest, outsider] = await User.create(
      ["owner", "member", "guest", "outsider"].map((name) => ({
        name,
        email: `${name}-${stamp}@example.com`,
        password: "not-a-real-hash",
      }))
    );
    workspace = await Workspace.create({
      ownerId: owner._id,
      name: "Studio",
      members: [
        { userId: owner._id, role: "owner" },
        { userId: member._id, role: "member" },
        { userId: guest._id, role: "guest" },
      ],
      projects: [{ name: "Launch" }],
    });
  });

  afterEach(async () => {
    await Promise.all([Task.deleteMany({}), Workspace.deleteMany({}), User.deleteMany({})]);
  });

  describe("permissions", () => {
    it("resolves roles, and never lets a project override raise access", () => {
      expect(collab.resolveWorkspaceRole(workspace, owner._id)).toBe("owner");
      expect(collab.resolveWorkspaceRole(workspace, outsider._id)).toBeNull();

      const project = { memberOverrides: [{ userId: guest._id, role: "admin" }] };
      expect(collab.resolveProjectRole(workspace, project, guest._id)).toBe("guest");

      const lowered = { memberOverrides: [{ userId: member._id, role: "guest" }] };
      expect(collab.resolveProjectRole(workspace, lowered, member._id)).toBe("guest");
    });

    it("hides private tasks from non-participants, including admins", () => {
      const task = { workspaceId: workspace._id, creatorId: member._id, visibility: "private" };
      expect(collab.canAccessTask("task.view", { role: "owner", userId: owner._id, task })).toBe(false);
      expect(collab.canAccessTask("task.view", { role: "member", userId: member._id, task })).toBe(true);
    });

    it("lets guests update only tasks they participate in", () => {
      const task = { workspaceId: workspace._id, creatorId: owner._id, assigneeIds: [guest._id] };
      expect(collab.canAccessTask("task.update.any", { role: "guest", userId: guest._id, task })).toBe(true);
      expect(
        collab.canAccessTask("task.update.any", { role: "guest", userId: guest._id, task: { ...task, assigneeIds: [] } })
      ).toBe(false);
    });

    it("keeps personal tasks creator-only", () => {
      const task = { creatorId: owner._id };
      expect(collab.canAccessTask("task.view", { role: null, userId: owner._id, task })).toBe(true);
      expect(collab.canAccessTask("task.view", { role: null, userId: member._id, task })).toBe(false);
    });
  });

  describe("recurrence date maths", () => {
    it("clamps short months without drifting afterwards", () => {
      const out = collab.computeOccurrences(
        { frequency: "monthly" },
        { anchor: d("2026-01-31"), until: d("2026-04-30") }
      );
      expect(keys(out)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
    });

    it("expands weekly byWeekday and honours endDate", () => {
      // 2026-09-07 is a Monday; Mon(1) and Thu(4).
      const out = collab.computeOccurrences(
        { frequency: "weekly", byWeekday: [1, 4], endDate: d("2026-09-14") },
        { anchor: d("2026-09-07"), until: d("2026-09-30") }
      );
      expect(keys(out)).toEqual(["2026-09-07", "2026-09-10", "2026-09-14"]);
    });

    it("respects maxOccurrences and the per-run ceiling", () => {
      expect(
        collab.computeOccurrences(
          { frequency: "daily", maxOccurrences: 5, generatedCount: 3 },
          { anchor: d("2026-09-01"), until: d("2026-09-30") }
        )
      ).toHaveLength(2);
      expect(
        collab.computeOccurrences({ frequency: "daily" }, { anchor: d("2020-01-01"), until: d("2030-01-01") }).length
      ).toBeLessThanOrEqual(200);
    });

    it("keys occurrences in the rule's timezone", () => {
      const late = new Date("2026-09-21T23:30:00.000Z");
      expect(collab.occurrenceKeyFor(late, "Asia/Tokyo")).toBe("2026-09-22");
      expect(collab.occurrenceKeyFor(late, "Not/AZone")).toBe("2026-09-21");
    });
  });

  describe("recurring task generation", () => {
    const until = d("2026-09-22");
    const makeParent = () =>
      Task.create({
        creatorId: owner._id,
        title: "Weekly upload",
        dueDate: d("2026-09-01"),
        subtasks: [{ title: "Record", completed: true }],
        recurring: { isRecurring: true, frequency: "weekly", timezone: "UTC" },
      });

    it("generates the occurrences after the parent, with subtasks reset", async () => {
      const parent = await makeParent();
      const result = await collab.materializeOccurrences(parent.toObject(), { until });

      // The parent (Sep 1) is the first occurrence; copies follow on Sep 8, 15 and 22.
      expect(result.created).toBe(3);
      const child = await Task.findOne({ seriesId: parent._id }).lean();
      expect(child.subtasks[0].completed).toBe(false);
    });

    it("never duplicates under repeated or concurrent runs", async () => {
      const snapshot = (await makeParent()).toObject();

      await Promise.all([
        collab.materializeOccurrences(snapshot, { until }),
        collab.materializeOccurrences(snapshot, { until }),
        collab.materializeOccurrences(snapshot, { until }),
      ]);
      await collab.materializeOccurrences(snapshot, { until });

      expect(await Task.countDocuments({ seriesId: snapshot._id })).toBe(3);
    });

    it("rejects a duplicate occurrence at the database level", async () => {
      const seriesId = new mongoose.Types.ObjectId();
      await Task.create({ creatorId: owner._id, title: "A", seriesId, occurrenceKey: "2026-09-21" });
      await expect(
        Task.create({ creatorId: owner._id, title: "B", seriesId, occurrenceKey: "2026-09-21" })
      ).rejects.toThrow(/duplicate key/i);
    });

    it("does not treat generated occurrences as new series", async () => {
      await makeParent();
      await collab.generateDueRecurrences({ until });
      await collab.generateDueRecurrences({ until });

      expect(await Task.countDocuments({ seriesId: { $exists: true } })).toBe(3);
    });
  });

  describe("task model hooks", () => {
    it("keeps assigneeIds in sync through findByIdAndUpdate despite timestamps' $set", async () => {
      const task = await Task.create({ creatorId: owner._id, title: "T", assignedTo: [{ userId: member._id }] });
      const updated = await Task.findByIdAndUpdate(task._id, { assignedTo: [{ userId: guest._id }] }, { new: true });

      expect(updated.assigneeIds.map(String)).toEqual([String(guest._id)]);
    });

    it("stops the existing update endpoint from setting server-managed fields", async () => {
      const task = await Task.create({ creatorId: owner._id, title: "T" });
      const updated = await Task.findByIdAndUpdate(
        task._id,
        {
          title: "Renamed",
          workspaceId: workspace._id,
          comments: [{ authorId: outsider._id, body: "forged" }],
          activity: [],
        },
        { new: true }
      );

      expect(updated.title).toBe("Renamed");
      expect(updated.workspaceId).toBeUndefined();
      expect(updated.comments).toHaveLength(0);
    });

    it("records activity for changes made through the existing endpoints", async () => {
      const task = await Task.create({ creatorId: owner._id, title: "T" });
      const updated = await Task.findByIdAndUpdate(task._id, { status: "review" }, { new: true });

      expect(updated.activity).toHaveLength(1);
      expect(updated.activity[0]).toMatchObject({ type: "status_changed", from: "todo", to: "review" });
      expect(String(updated.activity[0].actorId)).toBe(String(owner._id));
    });
  });

  describe("workspaces and team tasks", () => {
    it("returns 404, not 403, to non-members", async () => {
      const res = await call(controller.getWorkspace, outsider._id, {
        params: { workspaceId: String(workspace._id) },
      });
      expect(res.statusCode).toBe(404);
    });

    it("only lets the owner add admins", async () => {
      const [asMember, asOwner] = await Promise.all([
        call(controller.addMember, member._id, {
          params: { workspaceId: String(workspace._id) },
          body: { email: outsider.email, role: "member" },
        }),
        call(controller.addMember, owner._id, {
          params: { workspaceId: String(workspace._id) },
          body: { email: outsider.email, role: "admin" },
        }),
      ]);
      expect(asMember.statusCode).toBe(403);
      expect(asOwner.statusCode).toBe(201);
    });

    it("creates a team task, assigning members only, and notifies them", async () => {
      const res = await call(controller.createTeamTask, owner._id, {
        params: { workspaceId: String(workspace._id) },
        body: { title: "Edit episode", assigneeIds: [String(member._id), String(outsider._id)] },
      });

      expect(res.statusCode).toBe(201);
      expect(res.body.task.assigneeIds.map(String)).toEqual([String(member._id)]);
      expect(smartNotificationService.sendNotification).toHaveBeenCalledWith(
        String(member._id),
        expect.objectContaining({ title: expect.stringContaining("Edit episode") })
      );
    });

    it("guests cannot create tasks", async () => {
      const res = await call(controller.createTeamTask, guest._id, {
        params: { workspaceId: String(workspace._id) },
        body: { title: "Nope" },
      });
      expect(res.statusCode).toBe(403);
    });

    it("lets an assignee move their task but not reassign it", async () => {
      const task = await Task.create({
        creatorId: owner._id,
        workspaceId: workspace._id,
        title: "T",
        assignedTo: [{ userId: member._id }],
      });

      const moved = await call(controller.updateTeamTask, member._id, {
        params: { id: String(task._id) },
        body: { status: "in_progress" },
      });
      expect(moved.statusCode).toBe(200);
      expect(moved.body.task.activity.at(-1)).toMatchObject({ type: "status_changed", to: "in_progress" });

      const reassigned = await call(controller.updateTeamTask, member._id, {
        params: { id: String(task._id) },
        body: { assigneeIds: [String(guest._id)] },
      });
      expect(reassigned.statusCode).toBe(403);
    });
  });

  describe("views", () => {
    beforeEach(async () => {
      await Task.create([
        { creatorId: owner._id, workspaceId: workspace._id, title: "Open", status: "todo", estimatedHours: 3, assignedTo: [{ userId: member._id }] },
        { creatorId: owner._id, workspaceId: workspace._id, title: "Secret", visibility: "private", status: "todo" },
        { creatorId: owner._id, workspaceId: workspace._id, title: "Unassigned", status: "review", estimatedHours: 2 },
        { creatorId: outsider._id, title: "Someone else's", status: "todo" },
      ]);
    });

    const view = (userId, name, query = {}) =>
      call(controller.getView, userId, {
        params: { view: name },
        query: { workspaceId: String(workspace._id), ...query },
      });

    it("scopes the board to the workspace and hides private tasks from members", async () => {
      const asMember = await view(member._id, "board");
      expect(asMember.body.columns.todo.map((t) => t.title)).toEqual(["Open"]);

      const asOwner = await view(owner._id, "board");
      expect(asOwner.body.totals.todo).toBe(2);
    });

    it("rejects outsiders", async () => {
      expect((await view(outsider._id, "board")).statusCode).toBe(404);
    });

    it("paginates the list without repeating rows", async () => {
      const first = await view(owner._id, "list", { limit: "2" });
      const second = await view(owner._id, "list", { limit: "2", cursor: first.body.nextCursor });
      const ids = [...first.body.tasks, ...second.body.tasks].map((t) => String(t._id));

      expect(first.body.hasMore).toBe(true);
      expect(new Set(ids).size).toBe(3);
    });

    it("aggregates workload per assignee", async () => {
      const res = await view(owner._id, "workload");
      const row = res.body.workload.find((w) => String(w.user._id) === String(member._id));

      expect(row).toMatchObject({ taskCount: 1, estimatedHours: 3 });
      expect(row.user.name).toBe("member");
      expect(res.body.unassigned.taskCount).toBe(2);
    });

    it("requires a valid calendar range", async () => {
      expect((await view(owner._id, "calendar")).statusCode).toBe(400);
    });

    it("falls back to the caller's personal tasks without a workspace", async () => {
      const res = await call(controller.getView, outsider._id, { params: { view: "list" } });
      expect(res.body.tasks.map((t) => t.title)).toEqual(["Someone else's"]);
    });
  });

  describe("comments, dependencies and links", () => {
    let task;

    beforeEach(async () => {
      task = await Task.create({ creatorId: owner._id, workspaceId: workspace._id, title: "Cut trailer" });
    });

    it("stores plain-text comments, filters mentions and blocks unsafe attachment URLs", async () => {
      const res = await call(controller.addComment, member._id, {
        params: { id: String(task._id) },
        body: {
          body: '<img src=x onerror="alert(1)">',
          mentions: [String(guest._id), String(outsider._id)],
          attachments: [
            { name: "cut.mp4", url: "/uploads/cut.mp4" },
            { name: "evil", url: "javascript:alert(1)" },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.body.comment.body).toBe('<img src=x onerror="alert(1)">');
      expect(res.body.comment.mentions.map(String)).toEqual([String(guest._id)]);
      expect(res.body.comment.attachments.map((a) => a.name)).toEqual(["cut.mp4"]);
    });

    it("keeps soft-deleted comments out of the details but in the database", async () => {
      await call(controller.addComment, member._id, { params: { id: String(task._id) }, body: { body: "hi" } });
      const commentId = (await Task.findById(task._id)).comments[0]._id;

      const byGuest = await call(controller.deleteComment, guest._id, {
        params: { id: String(task._id), commentId: String(commentId) },
      });
      expect(byGuest.statusCode).toBe(403);

      await call(controller.deleteComment, member._id, {
        params: { id: String(task._id), commentId: String(commentId) },
      });
      const details = await call(controller.getTaskDetails, owner._id, { params: { id: String(task._id) } });

      expect(details.body.task.comments).toHaveLength(0);
      expect((await Task.findById(task._id)).comments).toHaveLength(1);
    });

    it("rejects dependency cycles and cross-scope dependencies", async () => {
      const prereq = await Task.create({ creatorId: owner._id, workspaceId: workspace._id, title: "Script" });
      const foreign = await Task.create({ creatorId: outsider._id, title: "Not yours" });
      const add = (id, dependsOnId) =>
        call(controller.addDependency, owner._id, { params: { id: String(id) }, body: { dependsOnId: String(dependsOnId) } });

      expect((await add(task._id, prereq._id)).statusCode).toBe(201);
      expect((await add(prereq._id, task._id)).body.error).toMatch(/circular/i);
      expect((await add(task._id, task._id)).statusCode).toBe(400);
      expect((await add(task._id, foreign._id)).statusCode).toBe(404);
      expect((await add(task._id, prereq._id)).statusCode).toBe(409);
    });

    it("detects deep cycles", async () => {
      const a = await Task.create({ creatorId: owner._id, title: "A" });
      const b = await Task.create({ creatorId: owner._id, title: "B", dependencies: [a._id] });
      const c = await Task.create({ creatorId: owner._id, title: "C", dependencies: [b._id] });

      expect(await collab.wouldCreateCycle(a._id, c._id)).toBe(true);
      expect(await collab.wouldCreateCycle(c._id, a._id)).toBe(false);
    });

    it("only links records owned by the task's creator", async () => {
      // model/url.js exports a mock-aware wrapper; use the registered model.
      require("../model/url");
      const Url = mongoose.model("Url");
      const [theirs, mine] = await Promise.all([
        Url.collection.insertOne({ shortId: "theirs", redirectURL: "https://x.test", userId: outsider._id }),
        Url.collection.insertOne({ shortId: "mine", redirectURL: "https://x.test", userId: owner._id }),
      ]);
      const link = (refId) =>
        call(controller.addLink, owner._id, {
          params: { id: String(task._id) },
          body: { module: "url", refId: String(refId) },
        });

      const refused = await link(theirs.insertedId);
      expect(refused.statusCode).toBe(400);
      expect(refused.body.error).toMatch(/not found/i);

      const accepted = await link(mine.insertedId);
      expect(accepted.statusCode).toBe(201);
      expect(accepted.body.links[0].label).toBe("mine");
    });
  });

  describe("templates", () => {
    it("creates a task with subtask dates relative to the start date", async () => {
      const res = await call(controller.applyTemplate, owner._id, {
        params: { key: "content_production" },
        body: { startDate: "2026-10-01", workspaceId: String(workspace._id) },
      });

      expect(res.statusCode).toBe(201);
      expect(res.body.task.subtasks).toHaveLength(7);
      expect(res.body.task.dueDate.toISOString().slice(0, 10)).toBe("2026-10-08");
      expect(String(res.body.task.workspaceId)).toBe(String(workspace._id));
    });

    it("404s for an unknown template", async () => {
      const res = await call(controller.applyTemplate, owner._id, { params: { key: "nope" } });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("repeat rules from the UI", () => {
    it("whitelists and clamps user input", () => {
      expect(collab.sanitizeRecurrence(null)).toBeNull();
      expect(collab.sanitizeRecurrence({ frequency: "hourly" })).toBeNull();

      const rule = collab.sanitizeRecurrence({
        frequency: "weekly",
        interval: "9999",
        byWeekday: [1, 9, "3"],
        maxOccurrences: "5",
        generatedCount: 500,
        lastGeneratedFor: "2020-01-01",
      });
      expect(rule).toEqual({
        isRecurring: true,
        frequency: "weekly",
        interval: 365,
        timezone: "UTC",
        byWeekday: [1, 3],
        maxOccurrences: 5,
      });
    });

    it("generates upcoming occurrences as soon as a repeating team task is created", async () => {
      const res = await call(controller.createTeamTask, owner._id, {
        params: { workspaceId: String(workspace._id) },
        body: { title: "Daily standup", dueDate: new Date().toISOString(), recurring: { frequency: "daily" } },
      });

      expect(res.statusCode).toBe(201);
      expect(await Task.countDocuments({ seriesId: res.body.task._id })).toBeGreaterThan(0);
    });

    it("lets a creator make a personal task repeat, and records it", async () => {
      const task = await Task.create({ creatorId: owner._id, title: "Newsletter", dueDate: new Date() });
      const res = await call(controller.updateTeamTask, owner._id, {
        params: { id: String(task._id) },
        body: { recurring: { frequency: "weekly" } },
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.task.recurring).toMatchObject({ isRecurring: true, frequency: "weekly" });
      expect(res.body.task.activity.at(-1)).toMatchObject({ type: "repeat_changed", from: "none", to: "weekly" });
      expect(await Task.countDocuments({ seriesId: task._id })).toBeGreaterThan(0);
    });

    it("stops non-authors and generated occurrences from changing the repeat", async () => {
      const task = await Task.create({
        creatorId: owner._id,
        workspaceId: workspace._id,
        title: "T",
        assignedTo: [{ userId: member._id }],
      });
      const asMember = await call(controller.updateTeamTask, member._id, {
        params: { id: String(task._id) },
        body: { recurring: { frequency: "daily" } },
      });
      expect(asMember.statusCode).toBe(403);

      const occurrence = await Task.create({
        creatorId: owner._id,
        title: "Copy",
        seriesId: task._id,
        occurrenceKey: "2026-09-01",
      });
      const onCopy = await call(controller.updateTeamTask, owner._id, {
        params: { id: String(occurrence._id) },
        body: { recurring: { frequency: "daily" } },
      });
      expect(onCopy.statusCode).toBe(400);
    });

    it("edits status, priority and due date and records each change", async () => {
      const task = await Task.create({ creatorId: owner._id, workspaceId: workspace._id, title: "T" });
      const res = await call(controller.updateTeamTask, owner._id, {
        params: { id: String(task._id) },
        body: { status: "review", priority: "urgent", dueDate: "2026-10-01" },
      });

      expect(res.body.task.activity.map((a) => a.type)).toEqual(
        expect.arrayContaining(["status_changed", "priority_changed", "dueDate_changed"])
      );
    });
  });

  describe("link picker and details", () => {
    let task;

    beforeEach(async () => {
      task = await Task.create({
        creatorId: owner._id,
        workspaceId: workspace._id,
        title: "Sponsor video",
        assignedTo: [{ userId: member._id }],
      });
    });

    // Raw inserts keep these tests independent of CrmDeal's required fields.
    const Deal = () => {
      require("../model/crmDeal");
      return mongoose.model("CrmDeal");
    };

    it("lists only the caller's own records", async () => {
      await Deal().collection.insertMany([
        { creatorId: member._id, dealName: "Member deal", createdAt: new Date() },
        { creatorId: owner._id, dealName: "Owner deal", createdAt: new Date() },
      ]);

      const res = await call(controller.getLinkOptions, member._id, {
        query: { module: "crm_deal", search: "deal" },
      });
      expect(res.body.options.map((o) => o.label)).toEqual(["Member deal"]);
    });

    it("lets an assignee link their own record to a team task", async () => {
      const { insertedId } = await Deal().collection.insertOne({ creatorId: member._id, dealName: "Member deal" });

      const res = await call(controller.addLink, member._id, {
        params: { id: String(task._id) },
        body: { module: "crm_deal", refId: String(insertedId) },
      });
      expect(res.statusCode).toBe(201);
    });

    it("tells the drawer whether the caller can moderate and is watching", async () => {
      const before = await call(controller.getTaskDetails, member._id, { params: { id: String(task._id) } });
      expect(before.body).toMatchObject({ canModerate: false, watching: false });
      expect(before.body.projects.map((p) => p.name)).toEqual(["Launch"]);

      await call(controller.toggleWatch, member._id, { params: { id: String(task._id) } });
      const after = await call(controller.getTaskDetails, member._id, { params: { id: String(task._id) } });
      expect(after.body.watching).toBe(true);
    });
  });

  it("paginates tasks that have no due date (regression)", async () => {
    await Task.create(
      Array.from({ length: 5 }, (_, i) => ({ creatorId: owner._id, title: `No date ${i}` }))
    );

    const seen = [];
    let cursor;
    do {
      const res = await call(controller.getView, owner._id, {
        params: { view: "list" },
        query: { limit: "2", ...(cursor ? { cursor } : {}) },
      });
      seen.push(...res.body.tasks.map((t) => String(t._id)));
      cursor = res.body.nextCursor;
    } while (cursor);

    expect(new Set(seen).size).toBe(5);
  });
});
