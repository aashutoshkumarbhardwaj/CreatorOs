const { validateBioProfileInput, MAX_LINKS, MAX_TAGS } = require("../../utils/bioProfileValidation");

describe("bio profile payload validation", () => {
  it("normalizes a valid bio profile payload", () => {
    const result = validateBioProfileInput({
      handle: " creator_123 ",
      name: " Creator ",
      bio: "Useful links",
      tags: [" resources "],
      avatarUrl: " https://example.com/avatar.png ",
      links: [
        {
          type: " resource ",
          label: " Free guide ",
          url: " https://example.com/guide ",
          icon: " book ",
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      handle: "creator_123",
      name: "Creator",
      bio: "Useful links",
      tags: ["resources"],
      avatarUrl: "https://example.com/avatar.png",
      links: [
        {
          type: "resource",
          label: "Free guide",
          url: "https://example.com/guide",
          icon: "book",
        },
      ],
    });
  });

  it("rejects invalid handles", () => {
    const result = validateBioProfileInput({ handle: "no spaces allowed" });

    expect(result).toEqual({
      success: false,
      message: "Handle must be 3-50 characters and contain only letters, numbers, hyphens, or underscores",
    });
  });

  it("rejects non-http avatar URLs", () => {
    const result = validateBioProfileInput({ avatarUrl: "javascript:alert(1)" });

    expect(result).toEqual({
      success: false,
      message: "Avatar URL must be a valid HTTP or HTTPS URL",
    });
  });

  it("rejects too many tags", () => {
    const result = validateBioProfileInput({
      tags: Array.from({ length: MAX_TAGS + 1 }, (_, index) => `tag-${index}`),
    });

    expect(result).toEqual({
      success: false,
      message: `Tags must be an array of up to ${MAX_TAGS} non-empty strings`,
    });
  });

  it("rejects invalid links and oversized link arrays", () => {
    expect(validateBioProfileInput({
      links: [{ type: "resource", label: "Guide", url: "ftp://example.com/file" }],
    })).toEqual({
      success: false,
      message: `Links must be an array of up to ${MAX_LINKS} valid HTTP or HTTPS links`,
    });

    expect(validateBioProfileInput({
      links: Array.from({ length: MAX_LINKS + 1 }, () => ({
        type: "resource",
        label: "Guide",
        url: "https://example.com/guide",
      })),
    })).toEqual({
      success: false,
      message: `Links must be an array of up to ${MAX_LINKS} valid HTTP or HTTPS links`,
    });
  });
});
