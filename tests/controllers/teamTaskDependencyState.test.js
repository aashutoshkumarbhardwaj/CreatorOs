/**
 * Dependency-state integrity tests for team tasks.
 * The TeamTask model is replaced by a tiny in-memory fake so the controller and
 * service logic (cycle checks, status rules, cascades) run for real.
 */
jest.mock("../../model/teamTaskDependency", () => {
  const store = new Map();
  let counter = 0;
  const newId = () => `64b7f0000000000000000${String(++counter).padStart(3, "0")}`;
  const s = (v) => String(v);

  const matchValue = (actual, cond) => {
    if (cond && typeof cond === "object" && !Array.isArray(cond)) {
      if ("$in" in cond) return cond.$in.map(s).includes(s(actual));
      if ("$ne" in cond) return s(actual) !== s(cond.$ne);
    }
    return s(actual) === s(cond);
  };
  const matches = (doc, filter) => Object.keys(filter).every((k) => matchValue(doc[k], filter[k]));
  const clone = (d) => (d ? JSON.parse(JSON.stringify(d)) : d);

  const applyUpdate = (doc, u) => {
    Object.entries(u.$set || {}).forEach(([k, v]) => { doc[k] = v; });
    Object.keys(u.$unset || {}).forEach((k) => { delete doc[k]; });
    Object.entries(u.$inc || {}).forEach(([k, v]) => { doc[k] = (doc[k] || 0) + v; });
    Object.entries(u.$addToSet || {}).forEach(([k, v]) => {
      if (!doc[k].map(s).includes(s(v))) doc[k].push(v);
    });
    Object.entries(u.$pull || {}).forEach(([k, v]) => { doc[k] = doc[k].filter((x) => s(x) !== s(v)); });
  };

  const query = (getter) => {
    const q = {
      select: () => q,
      lean: () => q,
      populate: () => q,
      then: (res, rej) => Promise.resolve(getter()).then(res, rej),
    };
    return q;
  };

  class TeamTask {
    constructor(data) {
      Object.assign(this, { blockedBy: [], dependents: [], status: "todo" }, data);
      this._id = this._id || newId();
    }
    async save() { store.set(s(this._id), clone(this)); return this; }
    static __reset() { store.clear(); }
    static __put(doc) { const d = { blockedBy: [], dependents: [], ...doc }; store.set(s(d._id), clone(d)); return d; }
    static __get(id) { return clone(store.get(s(id))); }
    static find(filter) { return query(() => [...store.values()].filter((d) => matches(d, filter)).map(clone)); }
    static findOne(filter) { return query(() => clone([...store.values()].find((d) => matches(d, filter)))); }
    static findById(id) { return query(() => clone(store.get(s(id)))); }
    static countDocuments(filter) { return Promise.resolve([...store.values()].filter((d) => matches(d, filter)).length); }
    static async findOneAndUpdate(filter, update) {
      const doc = [...store.values()].find((d) => matches(d, filter));
      if (!doc) return null;
      applyUpdate(doc, update);
      return clone(doc);
    }
    static async updateMany(filter, update) {
      const docs = [...store.values()].filter((d) => matches(d, filter));
      docs.forEach((d) => applyUpdate(d, update));
      return { modifiedCount: docs.length };
    }
  }
  return TeamTask;
});

const TeamTask = require("../../model/teamTaskDependency");
const controller = require("../../controller/teamTaskController");
const { wouldCreateCycle, topologicalSort, findUnsortableTasks } = require("../../services/taskDependencyService");

const CREATOR = "64a000000000000000000001";
const OTHER = "64a000000000000000000002";
const id = (n) => `64b1000000000000000000${String(n).padStart(2, "0")}`;

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const put = (n, extra = {}) => TeamTask.__put({ _id: id(n), creatorId: CREATOR, title: `T${n}`, status: "todo", ...extra });

beforeEach(() => TeamTask.__reset());

describe("wouldCreateCycle", () => {
  it("detects direct, transitive and self cycles and allows safe edges", async () => {
    put(1, { dependents: [id(2)] });
    put(2, { dependents: [id(3)], blockedBy: [id(1)] });
    put(3, { blockedBy: [id(2)] });
    expect(await wouldCreateCycle(id(1), id(1), CREATOR)).toBe(true);
    expect(await wouldCreateCycle(id(1), id(3), CREATOR)).toBe(true); // 3 would block 1, but 1 -> 2 -> 3
    expect(await wouldCreateCycle(id(3), id(1), CREATOR)).toBe(false);
  });

  it("does not walk into another creator's tasks", async () => {
    put(1, { dependents: [id(2)] });
    put(2, { creatorId: OTHER, dependents: [id(3)] });
    put(3);
    expect(await wouldCreateCycle(id(1), id(3), CREATOR)).toBe(false);
  });
});

describe("createTeamTask", () => {
  it("does not block a new task whose blockers are all already completed", async () => {
    put(1, { status: "completed" });
    const res = mockRes();
    await controller.createTeamTask({ user: { _id: CREATOR }, body: { title: "New", blockedByIds: [id(1), id(1)] } }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].task.status).toBe("todo");
  });

  it("blocks a new task with an unfinished blocker and links dependents", async () => {
    put(1, { status: "in_progress" });
    const res = mockRes();
    await controller.createTeamTask({ user: { _id: CREATOR }, body: { title: "New", blockedByIds: [id(1)] } }, res);
    expect(res.json.mock.calls[0][0].task.status).toBe("blocked");
    expect(TeamTask.__get(id(1)).dependents).toHaveLength(1);
  });
});

describe("addDependency", () => {
  it("rolls back an edge that closes a cycle after a concurrent write", async () => {
    // Simulates the race: B <- A already landed (A blocks B) between our pre-check and writes.
    put(1, { dependents: [id(2)] });            // A
    put(2, { blockedBy: [id(1)], status: "blocked" }); // B
    // Now request "A blocked by B": pre-check must reject it outright.
    const res = mockRes();
    await controller.addDependency({ user: { _id: CREATOR }, body: { taskId: id(1), prerequisiteTaskId: id(2) } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(TeamTask.__get(id(1)).blockedBy).toHaveLength(0);
  });

  it("never re-blocks a completed task and does not block on a completed prerequisite", async () => {
    put(1, { status: "completed" });
    put(2, { status: "completed" });
    put(3, { status: "todo" });
    const done = mockRes();
    await controller.addDependency({ user: { _id: CREATOR }, body: { taskId: id(1), prerequisiteTaskId: id(3) } }, done);
    expect(TeamTask.__get(id(1)).status).toBe("completed");

    const ok = mockRes();
    await controller.addDependency({ user: { _id: CREATOR }, body: { taskId: id(3), prerequisiteTaskId: id(2) } }, ok);
    expect(TeamTask.__get(id(3)).status).toBe("todo");
  });

  it("blocks a todo task on an unfinished prerequisite and returns the fresh task", async () => {
    put(1);
    put(2);
    const res = mockRes();
    await controller.addDependency({ user: { _id: CREATOR }, body: { taskId: id(2), prerequisiteTaskId: id(1) } }, res);
    expect(res.json.mock.calls[0][0].task.status).toBe("blocked");
  });

  it("is idempotent and rejects malformed ids", async () => {
    put(1, { dependents: [id(2)] });
    put(2, { blockedBy: [id(1)], status: "blocked" });
    const again = mockRes();
    await controller.addDependency({ user: { _id: CREATOR }, body: { taskId: id(2), prerequisiteTaskId: id(1) } }, again);
    expect(again.status).toHaveBeenCalledWith(200);
    const bad = mockRes();
    await controller.addDependency({ user: { _id: CREATOR }, body: { taskId: "nope", prerequisiteTaskId: id(1) } }, bad);
    expect(bad.status).toHaveBeenCalledWith(400);
  });
});

describe("updateTaskStatus", () => {
  const patch = async (n, body) => {
    const res = mockRes();
    await controller.updateTaskStatus({ user: { _id: CREATOR }, params: { id: id(n) }, body }, res);
    return res;
  };

  it("refuses to progress or complete a task with unfinished blockers (DAG bypass)", async () => {
    put(1, { dependents: [id(2)] });
    put(2, { blockedBy: [id(1)], dependents: [id(3)], status: "blocked" });
    put(3, { blockedBy: [id(2)], status: "blocked" });
    const res = await patch(2, { status: "completed" });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(TeamTask.__get(id(2)).status).toBe("blocked");
    expect(TeamTask.__get(id(3)).status).toBe("blocked");
  });

  it("refuses to mark a task blocked when nothing blocks it", async () => {
    put(1);
    expect((await patch(1, { status: "blocked" })).status).toHaveBeenCalledWith(409);
  });

  it("rejects invalid status and negative hours with 400", async () => {
    put(1);
    expect((await patch(1, { status: "done" })).status).toHaveBeenCalledWith(400);
    expect((await patch(1, { loggedHours: -3 })).status).toHaveBeenCalledWith(400);
  });

  it("unblocks a dependent only when ALL its blockers are completed", async () => {
    put(1, { dependents: [id(3)] });
    put(2, { dependents: [id(3)] });
    put(3, { blockedBy: [id(1), id(2)], status: "blocked" });
    await patch(1, { status: "completed" });
    expect(TeamTask.__get(id(3)).status).toBe("blocked");
    const res = await patch(2, { status: "completed" });
    expect(TeamTask.__get(id(3)).status).toBe("todo");
    expect(res.json.mock.calls[0][0].unblockedDownstreamCount).toBe(1);
  });

  it("re-blocks unstarted dependents when a completed task is reopened and clears completedAt", async () => {
    put(1, { dependents: [id(2), id(3)], status: "completed", completedAt: new Date() });
    put(2, { blockedBy: [id(1)], status: "todo" });
    put(3, { blockedBy: [id(1)], status: "in_progress" });
    await patch(1, { status: "in_progress" });
    expect(TeamTask.__get(id(1)).completedAt).toBeUndefined();
    expect(TeamTask.__get(id(2)).status).toBe("blocked");
    expect(TeamTask.__get(id(3)).status).toBe("in_progress"); // started work is left alone
  });
});

describe("execution order", () => {
  it("reports tasks stuck on a cycle instead of silently dropping them", () => {
    const tasks = [
      { _id: "a", dependents: ["b"] },
      { _id: "b", dependents: ["a"] },
      { _id: "c", dependents: [] },
    ];
    const sorted = topologicalSort(tasks);
    expect(sorted.map((t) => t._id)).toEqual(["c"]);
    expect(findUnsortableTasks(tasks, sorted).map((t) => t._id)).toEqual(["a", "b"]);
  });
});
