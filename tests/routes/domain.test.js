const request = require("supertest");
const express = require("express");
const dns = require("dns");
const User = require("../../model/user");

const mockUserId = "60d5ecb8b5c9c62b3c7b3999";
const MOCK_USER_ID = mockUserId;

const mockProtect = jest.fn((req, res, next) => {
    req.user = { id: mockUserId };
    next();
});

jest.mock("../../middleware/auth", () => ({
    protect: (req, res, next) => {
        req.user = { id: "60d5ecb8b5c9c62b3c7b3999" };
        next();
    },
}));

jest.mock("../../model/user", () => ({
    findByIdAndUpdate: jest.fn().mockResolvedValue({ _id: "60d5ecb8b5c9c62b3c7b3999" }),
}));

jest.mock("dns", () => ({
    promises: {
        resolveCname: jest.fn(),
    },
}));

const domainRoutes = require("../../routes/domain");

const app = express();
app.use(express.json());
app.use("/api/domain", domainRoutes);

describe("Custom Domain Verification Route (/api/domain/verify)", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        delete process.env.MOCK_DOMAIN_VERIFICATION;
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it("fails with HTTP 400 when domain is missing from request body", async () => {
        const res = await request(app)
            .post("/api/domain/verify")
            .send({});

        expect(res.status).toBe(400);
        expect(res.body).toEqual({
            success: false,
            message: "Domain is required",
        });
        expect(dns.promises.resolveCname).not.toHaveBeenCalled();
        expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it("1. succeeds when DNS returns standard CNAME target ('cname.creatoros.com')", async () => {
        dns.promises.resolveCname.mockResolvedValue(["cname.creatoros.com"]);

        const res = await request(app)
            .post("/api/domain/verify")
            .send({ domain: "mybrand.com" });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            success: true,
            message: "Domain verified successfully",
        });
        expect(dns.promises.resolveCname).toHaveBeenCalledWith("mybrand.com");
        expect(User.findByIdAndUpdate).toHaveBeenCalledWith(MOCK_USER_ID, {
            customDomain: "mybrand.com",
            domainVerified: true,
        });
    });

    it("2. succeeds when DNS returns CNAME target with a trailing dot ('cname.creatoros.com.')", async () => {
        dns.promises.resolveCname.mockResolvedValue(["cname.creatoros.com."]);

        const res = await request(app)
            .post("/api/domain/verify")
            .send({ domain: "mybrand.com" });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            success: true,
            message: "Domain verified successfully",
        });
        expect(User.findByIdAndUpdate).toHaveBeenCalledWith(MOCK_USER_ID, {
            customDomain: "mybrand.com",
            domainVerified: true,
        });
    });

    it("3. succeeds when DNS returns uppercase CNAME target ('CNAME.CREATOROS.COM')", async () => {
        dns.promises.resolveCname.mockResolvedValue(["CNAME.CREATOROS.COM"]);

        const res = await request(app)
            .post("/api/domain/verify")
            .send({ domain: "mybrand.com" });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            success: true,
            message: "Domain verified successfully",
        });
        expect(User.findByIdAndUpdate).toHaveBeenCalledWith(MOCK_USER_ID, {
            customDomain: "mybrand.com",
            domainVerified: true,
        });
    });

    it("4. succeeds when DNS returns mixed-case CNAME target with a trailing dot ('cname.CreatorOS.com.')", async () => {
        dns.promises.resolveCname.mockResolvedValue(["cname.CreatorOS.com."]);

        const res = await request(app)
            .post("/api/domain/verify")
            .send({ domain: "mybrand.com" });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            success: true,
            message: "Domain verified successfully",
        });
        expect(User.findByIdAndUpdate).toHaveBeenCalledWith(MOCK_USER_ID, {
            customDomain: "mybrand.com",
            domainVerified: true,
        });
    });

    it("5. succeeds when DNS returns multiple records including the valid target", async () => {
        dns.promises.resolveCname.mockResolvedValue([
            "other-alias.example.com.",
            "cname.creatoros.com.",
        ]);

        const res = await request(app)
            .post("/api/domain/verify")
            .send({ domain: "mybrand.com" });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            success: true,
            message: "Domain verified successfully",
        });
        expect(User.findByIdAndUpdate).toHaveBeenCalledWith(MOCK_USER_ID, {
            customDomain: "mybrand.com",
            domainVerified: true,
        });
    });

    it("6. fails with HTTP 400 when DNS returns an invalid CNAME target", async () => {
        dns.promises.resolveCname.mockResolvedValue(["unrelated.target.com"]);

        const res = await request(app)
            .post("/api/domain/verify")
            .send({ domain: "mybrand.com" });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({
            success: false,
            message: "Domain DNS records are not pointing correctly",
        });
        expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it("7. preserves existing error handling when DNS resolution fails", async () => {
        dns.promises.resolveCname.mockRejectedValue(new Error("queryCname ENODATA"));

        const res = await request(app)
            .post("/api/domain/verify")
            .send({ domain: "mybrand.com" });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({
            success: false,
            message: "Failed to resolve domain",
        });
        expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it("8. succeeds when mock verification is enabled, even if DNS fails or target is invalid", async () => {
        process.env.MOCK_DOMAIN_VERIFICATION = "true";

        // Case A: Invalid record with mock mode enabled
        dns.promises.resolveCname.mockResolvedValue(["invalid.target.com"]);

        const resInvalid = await request(app)
            .post("/api/domain/verify")
            .send({ domain: "mockedbrand.com" });

        expect(resInvalid.status).toBe(200);
        expect(resInvalid.body).toEqual({
            success: true,
            message: "Domain verified successfully",
        });

        // Case B: DNS lookup error with mock mode enabled (triggers fallback in catch block)
        dns.promises.resolveCname.mockRejectedValue(new Error("ENOTFOUND"));

        const resError = await request(app)
            .post("/api/domain/verify")
            .send({ domain: "mockedbrand-dns-fail.com" });

        expect(resError.status).toBe(200);
        expect(resError.body).toEqual({
            success: true,
            message: "Domain verified successfully (mock)",
        });
        expect(User.findByIdAndUpdate).toHaveBeenCalledWith(MOCK_USER_ID, {
            customDomain: "mockedbrand-dns-fail.com",
            domainVerified: true,
        });
    });

    it("9. fails when mock verification is explicitly disabled and records are invalid", async () => {
        process.env.MOCK_DOMAIN_VERIFICATION = "false";
        dns.promises.resolveCname.mockResolvedValue(["invalid.target.com."]);

        const res = await request(app)
            .post("/api/domain/verify")
            .send({ domain: "mybrand.com" });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({
            success: false,
            message: "Domain DNS records are not pointing correctly",
        });
        expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
    });
});
