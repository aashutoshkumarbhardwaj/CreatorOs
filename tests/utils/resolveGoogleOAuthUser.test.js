const { resolveGoogleOAuthUser } = require("../../utils/resolveGoogleOAuthUser");

function createUserDoc(overrides = {}) {
  return {
    googleId: undefined,
    name: "Local User",
    email: "victim@gmail.com",
    avatar: null,
    password: "hashed",
    authProvider: "local",
    isVerified: false,
    lastLoginAt: null,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createUserModel({ byGoogleId = null, byEmail = null, created = null } = {}) {
  return {
    findOne: jest.fn(async (query) => {
      if (query.googleId) return byGoogleId;
      if (query.email) return byEmail;
      return null;
    }),
    create: jest.fn(async (doc) => created || { ...doc, save: jest.fn() }),
  };
}

const profile = {
  id: "google-123",
  displayName: "Victim Name",
  emails: [{ value: "Victim@Gmail.com" }],
  photos: [{ value: "https://example.com/avatar.png" }],
};

describe("resolveGoogleOAuthUser (#978)", () => {
  it("refuses to link Google onto an unverified local account", async () => {
    const unverified = createUserDoc({ isVerified: false });
    const User = createUserModel({ byEmail: unverified });

    const result = await resolveGoogleOAuthUser(profile, User);

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/not verified/i);
    expect(unverified.googleId).toBeUndefined();
    expect(unverified.isVerified).toBe(false);
    expect(unverified.save).not.toHaveBeenCalled();
    expect(User.create).not.toHaveBeenCalled();
  });

  it("links Google onto a verified local account without changing verification", async () => {
    const verified = createUserDoc({ isVerified: true });
    const User = createUserModel({ byEmail: verified });

    const result = await resolveGoogleOAuthUser(profile, User);

    expect(result.ok).toBe(true);
    expect(result.user.googleId).toBe("google-123");
    expect(result.user.isVerified).toBe(true);
    expect(verified.save).toHaveBeenCalled();
  });

  it("updates an existing Google-linked user", async () => {
    const existing = createUserDoc({
      googleId: "google-123",
      isVerified: true,
      name: "",
    });
    const User = createUserModel({ byGoogleId: existing });

    const result = await resolveGoogleOAuthUser(profile, User);

    expect(result.ok).toBe(true);
    expect(User.findOne).toHaveBeenCalledWith({ googleId: "google-123" });
    expect(existing.name).toBe("Victim Name");
    expect(existing.isVerified).toBe(true);
    expect(existing.save).toHaveBeenCalled();
  });

  it("creates a new verified Google user when email is unused", async () => {
    const created = createUserDoc({
      googleId: "google-123",
      isVerified: true,
      authProvider: "google",
      password: undefined,
    });
    const User = createUserModel({ created });

    const result = await resolveGoogleOAuthUser(profile, User);

    expect(result.ok).toBe(true);
    expect(User.create).toHaveBeenCalledWith(
      expect.objectContaining({
        googleId: "google-123",
        email: "victim@gmail.com",
        authProvider: "google",
        isVerified: true,
      })
    );
  });

  it("fails when Google profile has no email", async () => {
    const User = createUserModel();
    const result = await resolveGoogleOAuthUser(
      { id: "google-123", emails: [], displayName: "No Email" },
      User
    );

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/email/i);
    expect(User.findOne).not.toHaveBeenCalled();
  });
});
