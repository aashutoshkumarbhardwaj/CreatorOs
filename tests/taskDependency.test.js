const { topologicalSort } = require("../services/taskDependencyService");
const mongoose = require("mongoose");

describe("Team Task Dependency & DAG Engine Unit Tests", () => {
  describe("topologicalSort (Kahn Algorithm)", () => {
    it("should sort tasks in valid topological predecessor-to-successor sequence", () => {
      const taskAId = new mongoose.Types.ObjectId().toString();
      const taskBId = new mongoose.Types.ObjectId().toString();
      const taskCId = new mongoose.Types.ObjectId().toString();

      // Flow: Task A (Script) -> Task B (Voiceover) -> Task C (Video Edit)
      const taskA = {
        _id: taskAId,
        title: "Scripting",
        dependents: [taskBId],
      };

      const taskB = {
        _id: taskBId,
        title: "Voiceover Recording",
        dependents: [taskCId],
      };

      const taskC = {
        _id: taskCId,
        title: "Video Editing",
        dependents: [],
      };

      const unorderedTasks = [taskC, taskA, taskB];
      const sorted = topologicalSort(unorderedTasks);

      expect(sorted).toHaveLength(3);
      expect(String(sorted[0]._id)).toBe(taskAId);
      expect(String(sorted[1]._id)).toBe(taskBId);
      expect(String(sorted[2]._id)).toBe(taskCId);
    });

    it("should handle branching DAG tasks with multiple prerequisites", () => {
      const task1Id = "task_script";
      const task2Id = "task_thumbnail";
      const task3Id = "task_final_assembly";

      // Task 1 and Task 2 both feed into Task 3
      const task1 = { _id: task1Id, title: "Script", dependents: [task3Id] };
      const task2 = { _id: task2Id, title: "Thumbnail", dependents: [task3Id] };
      const task3 = { _id: task3Id, title: "Assembly", dependents: [] };

      const sorted = topologicalSort([task3, task1, task2]);

      expect(sorted).toHaveLength(3);
      // Assembly must be last
      expect(sorted[2]._id).toBe(task3Id);
    });
  });
});
