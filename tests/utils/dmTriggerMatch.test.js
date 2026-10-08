const { matchDmTrigger } = require("../../utils/dmTriggerMatch");

describe("matchDmTrigger", () => {
  it("returns null when nothing matches", () => {
    const triggers = [{ keyword: "price", responseUrl: "https://x.example" }];
    expect(matchDmTrigger(triggers, "hello there")).toBeNull();
  });

  it("matches case-insensitively", () => {
    const triggers = [{ keyword: "price", responseUrl: "https://x.example" }];
    expect(matchDmTrigger(triggers, "What is the PRICE?").keyword).toBe("price");
  });

  it("prefers the longest matching keyword", () => {
    const triggers = [
      { keyword: "price", responseUrl: "https://short.example" },
      { keyword: "group price", responseUrl: "https://long.example" },
    ];
    const hit = matchDmTrigger(triggers, "what is the group price?");
    expect(hit.responseUrl).toBe("https://long.example");
  });

  it("ignores blank keywords instead of matching everything", () => {
    const triggers = [{ keyword: "   ", responseUrl: "https://x.example" }];
    expect(matchDmTrigger(triggers, "anything at all")).toBeNull();
  });

  it("handles missing input", () => {
    expect(matchDmTrigger(null, "hi")).toBeNull();
    expect(matchDmTrigger([], "")).toBeNull();
  });
});
