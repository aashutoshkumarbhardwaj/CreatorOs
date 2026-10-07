const mongoose = require("mongoose");
const EventType = require("../../model/eventType");

describe("EventType ownership", () => {
  it("does not allow userId to be changed by an update", () => {
    const schemaPath = EventType.schema.path("userId");

    expect(schemaPath.options.immutable).toBe(true);
  });

  it("keeps the original owner when an update attempts to overwrite userId", async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const attackerId = new mongoose.Types.ObjectId();

    const eventType = await EventType.create({
      userId: ownerId,
      title: "Consultation",
      slug: "consultation-ownership-test",
      duration: 30,
    });

    await EventType.findByIdAndUpdate(
      eventType._id,
      { userId: attackerId, title: "Updated consultation" },
      { new: true, runValidators: true }
    );

    const updated = await EventType.findById(eventType._id).lean();

    expect(updated.userId.toString()).toBe(ownerId.toString());
    expect(updated.title).toBe("Updated consultation");
  });
});
