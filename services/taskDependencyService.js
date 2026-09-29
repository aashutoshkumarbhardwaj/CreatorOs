const TeamTask = require("../model/teamTaskDependency");

/**
 * Check if adding a dependency (targetTaskId depends on prerequisiteTaskId) creates a cycle
 * Returns true if cycle would be formed, false if safe DAG
 */
async function wouldCreateCycle(targetTaskId, prerequisiteTaskId) {
  if (String(targetTaskId) === String(prerequisiteTaskId)) {
    return true;
  }

  // To check if targetTaskId -> prerequisiteTaskId creates a cycle,
  // we check if there is already a path from targetTaskId to prerequisiteTaskId
  const visited = new Set();
  const queue = [targetTaskId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (String(currentId) === String(prerequisiteTaskId)) {
      return true; // Path exists, adding back edge would create cycle
    }

    if (!visited.has(String(currentId))) {
      visited.add(String(currentId));
      const task = await TeamTask.findById(currentId).select("dependents");
      if (task && task.dependents && task.dependents.length > 0) {
        for (const depId of task.dependents) {
          queue.push(depId);
        }
      }
    }
  }

  return false;
}

/**
 * Topologically sort creator tasks into execution order (Kahn's Algorithm)
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

  // If sorted contains fewer tasks than input, remaining tasks are in a cycle
  return sorted;
}

/**
 * Automatically unblock downstream tasks when all blockers are completed
 */
async function cascadeUnblockTasks(completedTaskId) {
  const completedTask = await TeamTask.findById(completedTaskId);
  if (!completedTask || !completedTask.dependents || completedTask.dependents.length === 0) {
    return [];
  }

  const unblockedTasks = [];

  for (const depId of completedTask.dependents) {
    const depTask = await TeamTask.findById(depId).populate("blockedBy");
    if (!depTask) continue;

    // Check if all tasks in blockedBy are completed
    const allBlockersResolved = depTask.blockedBy.every((blocker) => blocker.status === "completed");

    if (allBlockersResolved && depTask.status === "blocked") {
      depTask.status = "todo";
      await depTask.save();
      unblockedTasks.push(depTask);
    }
  }

  return unblockedTasks;
}

module.exports = {
  wouldCreateCycle,
  topologicalSort,
  cascadeUnblockTasks,
};
