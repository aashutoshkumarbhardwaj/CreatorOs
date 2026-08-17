const cron = require("node-cron");
const Task = require("../model/task");
const Notification = require("../model/notification");

async function checkTaskReminders() {
  const now = new Date();
  let notificationCount = 0;

  // Find unarchived tasks that have due dates in the next 24 hours or are overdue, but not yet marked complete
  const upcomingTasks = await Task.find({
    isArchived: false,
    status: { $ne: "completed" },
    dueDate: { $lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
  }).lean();

  for (const task of upcomingTasks) {
    const isOverdue = new Date(task.dueDate) < now;
    const dedupKey = `task_reminder_${task._id}_${isOverdue ? "overdue" : "due_soon"}`;

    const existingNotif = await Notification.findOne({
      userId: task.creatorId,
      deduplicationKey: dedupKey,
    }).lean();

    if (!existingNotif) {
      await Notification.create({
        userId: task.creatorId,
        title: isOverdue ? `⚠️ Task Overdue: ${task.title}` : `⏰ Task Due Soon: ${task.title}`,
        message: isOverdue
          ? `Your task "${task.title}" was due on ${new Date(task.dueDate).toLocaleDateString()}.`
          : `Your task "${task.title}" is due soon.`,
        category: "system",
        priority: isOverdue ? "high" : "normal",
        channels: ["in_app"],
        status: "sent",
        deduplicationKey: dedupKey,
        metadata: { taskId: task._id },
      });
      notificationCount++;
    }
  }

  return notificationCount;
}

function startTaskReminderWorker() {
  if (
    process.env.NODE_ENV === "test" ||
    process.env.USE_MOCK_DB === "true" ||
    process.env.VERCEL === "1"
  ) {
    return;
  }

  // Check task reminders every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    try {
      const count = await checkTaskReminders();
      if (count > 0) {
        console.log(`[TaskReminderWorker] Created ${count} task notification(s).`);
      }
    } catch (err) {
      console.error("[TaskReminderWorker] Error checking task reminders:", err.message);
    }
  });
}

module.exports = {
  startTaskReminderWorker,
  checkTaskReminders,
};
