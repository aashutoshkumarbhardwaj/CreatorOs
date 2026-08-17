jest.mock("../../model/user", () => ({
  findByIdAndUpdate: jest.fn(),
  findOne: jest.fn(),
}));

function loadBillingController(stripeMock) {
  jest.resetModules();
  jest.doMock("../../model/user", () => ({
    findByIdAndUpdate: jest.fn(),
    findOne: jest.fn(),
  }));
  jest.doMock("stripe", () => jest.fn(() => stripeMock), { virtual: true });
  return require("../../controller/billing");
}

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    send: jest.fn(),
  };
}

describe("Stripe billing webhook", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  it("fails closed when the webhook secret is missing", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const stripeMock = {
      webhooks: {
        constructEvent: jest.fn(),
      },
    };
    const { handleWebhook } = loadBillingController(stripeMock);
    const res = createResponse();

    await handleWebhook({ headers: {}, body: Buffer.from("{}") }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Billing webhook is not configured correctly",
    });
    expect(stripeMock.webhooks.constructEvent).not.toHaveBeenCalled();
  });

  it("rejects requests without a Stripe signature", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_123";
    const stripeMock = {
      webhooks: {
        constructEvent: jest.fn(),
      },
    };
    const { handleWebhook } = loadBillingController(stripeMock);
    const res = createResponse();

    await handleWebhook({ headers: {}, body: Buffer.from("{}") }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Webhook Error: Missing Stripe signature");
    expect(stripeMock.webhooks.constructEvent).not.toHaveBeenCalled();
  });

  it("constructs the event from the signed raw body", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_123";
    const stripeMock = {
      webhooks: {
        constructEvent: jest.fn().mockReturnValue({ type: "unknown.event" }),
      },
    };
    const { handleWebhook } = loadBillingController(stripeMock);
    const res = createResponse();
    const body = Buffer.from("{}");

    await handleWebhook(
      { headers: { "stripe-signature": "sig_123" }, body },
      res,
      jest.fn()
    );

    expect(stripeMock.webhooks.constructEvent).toHaveBeenCalledWith(body, "sig_123", "whsec_123");
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });
});
