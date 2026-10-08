const TeamTask = require("../model/teamTaskDependency");

/**
 * Check if adding a dependency (targetTaskId depends on prerequisiteTaskId) creates a cycle.
 * Returns true if a cycle would be formed (or has been formed), false if the graph is a safe DAG.
 *
 * The graph is walked level by level with one batched query per level (instead of one query
 * per node) and, when creatorId is supplied, never leaves the caller's own tasks.
 */
async function wouldCreateCycle(targetTaskId, prerequisiteTaskId, creatorId = null) {
  const target = String(targetTaskId);
  const prerequisite = String(prerequisiteTaskId);

  if (target === prerequisite) {
    return true;
  }

  // Edge prerequisite -> target is being added. It closes a cycle iff target already
  // reaches prerequisite by following "dependents" edges.
  const visited = new Set([target]);
  let frontier = [target];

  while (frontier.length > 0) {
    const filter = { _id: { $in: frontier } };
    if (creatorId) filter.creatorId = creatorId;

    const rows = await TeamTask.find(filter).select("dependents").lean();
    const next = [];

    for (const row of rows) {
      for (const dep of row.dependents || []) {
        const depId = String(dep);
        if (depId === prerequisite) return true;
        if (!visited.has(depId)) {
          visited.add(depId);
          next.push(depId);
        }
      }
    }
    frontier = next;
  }

  return false;
}

/**
 * Topologically sort creator tasks into execution order (Kahn's Algorithm).
 * Tasks that are part of (or downstream of) a cycle are not returned; use
 * findUnsortableTasks() to report them instead of silently dropping them.
 */
function topologicalSort(tasks) {
  const taskMap = new Map();
  const inDegree = new Map();
  const adj = new Map();

  tasks.forEach((t) => {
    const id = String(t._id);
    taskMap.set(id, t);
    inDegree.set(id, 0);
    adj.set(id, []);
  });

  tasks.forEach((t) => {
    const u = String(t._id);
    if (t.dependents && t.dependents.length > 0) {
      t.dependents.forEach((vObj) => {
        const v = String(vObj._id || vObj);
        if (inDegree.has(v)) {
          adj.get(u).push(v);
          inDegree.set(v, inDegree.get(v) + 1);
        }
      });
    }
  });

  const queue = [];
  inDegree.forEach((deg, id) => {
    if (deg === 0) queue.push(id);
  });

  const sorted = [];
  while (queue.length > 0) {
    const curr = queue.shift();
    sorted.push(taskMap.get(curr));

    const neighbors = adj.get(curr) || [];
    for (const n of neighbors) {
      inDegree.set(n, inDegree.get(n) - 1);
      if (inDegree.get(n) === 0) {
        queue.push(n);
      }
    }
  }

  return sorted;
}

/**
 * Tasks that topologicalSort() could not place because they sit on / behind a cycle.
 */
function findUnsortableTasks(tasks, sorted) {
  const placed = new Set(sorted.map((t) => String(t._id)));
  return tasks.filter((t) => !placed.has(String(t._id)));
}

/**
 * Blockers of a task that are not completed yet.
 */
async function getPendingBlockers(blockedByIds) {
  if (!Array.isArray(blockedByIds) || blockedByIds.length === 0) return [];
  return TeamTask.find({ _id: { $in: blockedByIds }, status: { $ne: "completed" } })
    .select("title status")
    .lean();
}

/**
 * Automatically unblock downstream tasks when all blockers are completed.
 * Every transition is a conditional atomic update (status must still be "blocked"),
 * so a concurrent edit is never overwritten by a stale document.save().
 */
async function cascadeUnblockTasks(completedTaskId, creatorId = null) {
  const completedTask = await TeamTask.findById(completedTaskId).select("dependents creatorId").lean();
  if (!completedTask || !completedTask.dependents || completedTask.dependents.length === 0) {
    return [];
  }

  const owner = creatorId || completedTask.creatorId;
  const unblockedTasks = [];

  for (const depId of completedTask.dependents) {
    const depTask = await TeamTask.findOne({ _id: depId, creatorId: owner })
      .select("blockedBy status")
      .lean();
    if (!depTask || depTask.status !== "blocked") continue;

    const pending = await getPendingBlockers(depTask.blockedBy);
    if (pending.length > 0) continue;

    const unblocked = await TeamTask.findOneAndUpdate(
      { _id: depId, creatorId: owner, status: "blocked" },
      { $set: { status: "todo" } },
      { new: true }
    );
    if (unblocked) unblockedTasks.push(unblocked);
  }

  return unblockedTasks;
}

/**
 * When a completed task is reopened, direct dependents that have not started yet go back to
 * "blocked". Anything further downstream is already blocked (its own blocker is unfinished),
 * and work that has already started is left untouched.
 */
async function cascadeReblockTasks(reopenedTaskId, creatorId = null) {
  const task = await TeamTask.findById(reopenedTaskId).select("dependents creatorId").lean();
  if (!task || !task.dependents || task.dependents.length === 0) return 0;

  const result = await TeamTask.updateMany(
    { _id: { $in: task.dependents }, creatorId: creatorId || task.creatorId, status: "todo" },
    { $set: { status: "blocked" } }
  );
  return result && (result.modifiedCount ?? result.nModified ?? 0);
}

module.exports = {
  wouldCreateCycle,
  topologicalSort,
  findUnsortableTasks,
  getPendingBlockers,
  cascadeUnblockTasks,
  cascadeReblockTasks,
};
