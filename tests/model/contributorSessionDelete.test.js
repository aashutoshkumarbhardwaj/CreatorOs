process.env.USE_MOCK_DB = "true";

const ContributorSession = require("../../model/contributorSession");

describe("ContributorSession.deleteOne (#980)", () => {
  it("exports deleteOne and removes a mock session", async () => {
    expect(typeof ContributorSession.deleteOne).toBe("function");

    const contributorId = "guest-contributor-test-id";
    await ContributorSession.create({
      contributorId,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    expect(await ContributorSession.findOne({ contributorId })).not.toBeNull();

    const result = await ContributorSession.deleteOne({ contributorId });
    expect(result.deletedCount).toBe(1);
    expect(await ContributorSession.findOne({ contributorId })).toBeNull();
  });
});
