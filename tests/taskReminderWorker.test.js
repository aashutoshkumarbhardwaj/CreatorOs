const mongoose = require("mongoose");
const Task = require("../model/task");
const Notification = require("../model/notification");
const { checkTaskReminders } = require("../workers/taskReminderWorker");

describe("Task Reminder Worker", () => {
  let creatorId;

  beforeEach(async () => {
    await Notification.syncIndexes();
    await Task.deleteMany({});
    await Notification.deleteMany({});
    creatorId = new mongoose.Types.ObjectId();
  });

  afterEach(async () => {
    await Task.deleteMany({});
    await Notification.deleteMany({});
  });

  it("should create due_soon and overdue notifications properly", async () => {
    const now = new Date();

    // 1 overdue task
    const overdueTask = await Task.create({
      creatorId,
      title: "Overdue Video Edit",
      dueDate: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
      status: "in_progress",
    });

    // 1 due soon task (within 24 hours)
    const dueSoonTask = await Task.create({
      creatorId,
      title: "Due Soon Thumbnail",
      dueDate: new Date(now.getTime() + 10 * 60 * 60 * 1000), // 10 hours from now
      status: "todo",
    });

    // 1 task due in 48 hours (should not trigger)
    await Task.create({
      creatorId,
      title: "Far Future Task",
      dueDate: new Date(now.getTime() + 48 * 60 * 60 * 1000),
      status: "todo",
    });

    // 1 completed task (should not trigger)
    await Task.create({
      creatorId,
      title: "Completed Task",
      dueDate: new Date(now.getTime() - 1 * 60 * 60 * 1000),
      status: "completed",
    });

    const count = await checkTaskReminders();
    expect(count).toBe(2);

    const notifications = await Notification.find({ userId: creatorId }).lean();
    expect(notifications).toHaveLength(2);

    const overdueNotif = notifications.find(
      (n) => n.deduplicationKey === `task_reminder_${overdueTask._id}_overdue`
    );
    expect(overdueNotif).toBeDefined();
    expect(overdueNotif.title).toContain("Task Overdue");
    expect(overdueNotif.priority).toBe("high");

    const dueSoonNotif = notifications.find(
      (n) => n.deduplicationKey === `task_reminder_${dueSoonTask._id}_due_soon`
    );
    expect(dueSoonNotif).toBeDefined();
    expect(dueSoonNotif.title).toContain("Task Due Soon");
    expect(dueSoonNotif.priority).toBe("normal");
  });

  it("should not create duplicate notifications on subsequent sequential runs", async () => {
    const now = new Date();

    await Task.create({
      creatorId,
      title: "Record Podcast",
      dueDate: new Date(now.getTime() + 2 * 60 * 60 * 1000),
      status: "todo",
    });

    const firstRunCount = await checkTaskReminders();
    expect(firstRunCount).toBe(1);

    const secondRunCount = await checkTaskReminders();
    expect(secondRunCount).toBe(0);

    const totalNotifications = await Notification.countDocuments({ userId: creatorId });
    expect(totalNotifications).toBe(1);
  });

  it("should handle concurrent checkTaskReminders executions safely without duplicate notifications", async () => {
    const now = new Date();

    // Create 5 tasks due soon or overdue
    const tasks = [];
    for (let i = 0; i < 5; i++) {
      tasks.push(
        await Task.create({
          creatorId,
          title: `Concurrent Task ${i + 1}`,
          dueDate:
            i % 2 === 0
              ? new Date(now.getTime() - (i + 1) * 3600 * 1000)
              : new Date(now.getTime() + (i + 1) * 3600 * 1000),
          status: "todo",
        })
      );
    }

    // Run 5 concurrent checkTaskReminders() calls to simulate simultaneous worker executions
    const results = await Promise.all([
      checkTaskReminders(),
      checkTaskReminders(),
      checkTaskReminders(),
      checkTaskReminders(),
      checkTaskReminders(),
    ]);

    // The sum of notifications reported across all concurrent runs should equal total tasks (5)
    const totalCreatedReported = results.reduce((sum, c) => sum + c, 0);
    expect(totalCreatedReported).toBe(5);

    // Exactly 5 notifications must exist in MongoDB (no duplicates)
    const notifs = await Notification.find({ userId: creatorId }).lean();
    expect(notifs).toHaveLength(5);

    // Verify each task has exactly 1 notification with expected deduplicationKey
    const dedupKeys = new Set(notifs.map((n) => n.deduplicationKey));
    expect(dedupKeys.size).toBe(5);
  });
});
