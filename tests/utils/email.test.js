const mockCreateTransport = jest.fn();

jest.mock("nodemailer", () => ({
  createTransport: mockCreateTransport,
}));

const {
  createTransporter,
  isEmailTransportConfigured,
} = require("../../utils/email");

describe("email configuration", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    mockCreateTransport.mockReset();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("uses current environment values when creating a transporter", () => {
    delete process.env.EMAIL_USER;
    delete process.env.EMAIL_PASSWORD;
    delete process.env.EMAIL_SERVICE;

    process.env.EMAIL_USER = "sender@example.com";
    process.env.EMAIL_PASSWORD = "secret";
    process.env.EMAIL_SERVICE = "smtp";

    expect(isEmailTransportConfigured()).toBe(true);

    createTransporter();

    expect(mockCreateTransport).toHaveBeenCalledWith({
      auth: {
        user: "sender@example.com",
        pass: "secret",
      },
      service: "smtp",
    });
  });

  it("derives secure mode from the current port", () => {
    process.env.EMAIL_USER = "sender@example.com";
    process.env.EMAIL_PASSWORD = "secret";
    process.env.EMAIL_HOST = "smtp.example.com";
    process.env.EMAIL_PORT = "465";
    delete process.env.EMAIL_SERVICE;
    delete process.env.EMAIL_SECURE;

    createTransporter();

    expect(mockCreateTransport).toHaveBeenCalledWith({
      auth: {
        user: "sender@example.com",
        pass: "secret",
      },
      host: "smtp.example.com",
      port: 465,
      secure: true,
    });
  });
});
