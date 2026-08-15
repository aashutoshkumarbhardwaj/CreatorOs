const { verifyCsrf } = require("../../middleware/csrf");

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    redirect: jest.fn(),
    accepts: jest.fn(),
  };
}

describe("verifyCsrf", () => {
  it("allows safe methods without a CSRF token", () => {
    const req = { method: "GET", path: "/api/urls", cookies: {}, headers: {}, originalUrl: "/api/urls" };
    const res = createResponse();
    const next = jest.fn();

    verifyCsrf(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("blocks a POST to a non-exempt path with a missing or mismatched token", () => {
    const req = {
      method: "POST",
      path: "/bio/save",
      cookies: { _csrf: "abc123" },
      headers: {},
      body: {},
      originalUrl: "/bio/save",
      accepts: jest.fn().mockReturnValue(true),
    };
    const res = createResponse();
    res.accepts = req.accepts;
    const next = jest.fn();

    verifyCsrf(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Invalid CSRF token. Request blocked.",
      error: "CSRF token mismatch",
    });
  });

  it("allows a POST to the Instagram webhook path without a CSRF token", () => {
    const req = {
      method: "POST",
      path: "/api/instagram/webhook",
      cookies: {},
      headers: {},
      body: {},
      originalUrl: "/api/instagram/webhook",
    };
    const res = createResponse();
    const next = jest.fn();

    verifyCsrf(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("still requires a valid CSRF token on other POST routes even if their prefix overlaps the exempt path", () => {
    const req = {
      method: "POST",
      path: "/api/instagram/other-action",
      cookies: { _csrf: "abc123" },
      headers: {},
      body: {},
      originalUrl: "/api/instagram/other-action",
      accepts: jest.fn().mockReturnValue(true),
    };
    const res = createResponse();
    res.accepts = req.accepts;
    const next = jest.fn();

    verifyCsrf(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});