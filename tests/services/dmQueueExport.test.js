describe("dmQueueService exports (#981)", () => {
  it("exports dmQueue with an add method", () => {
    const exported = require("../../services/dmQueueService");
    expect(Object.keys(exported)).toEqual(
      expect.arrayContaining(["dmQueue", "dmWorker"])
    );
    expect(exported.dmQueue).toBeDefined();
    expect(typeof exported.dmQueue.add).toBe("function");
  });
});
