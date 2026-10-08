const CrmInvoice = require("../../model/crmInvoice");
const InvoiceCounter = require("../../model/invoiceCounter");
const {
  generateInvoiceNumber,
  parseInvoiceSequence,
  formatInvoiceNumber,
} = require("../../utils/invoiceNumber");

describe("invoice numbers", () => {
  const creatorA = "64b7f1f1f1f1f1f1f1f1f1a1";
  const creatorB = "64b7f1f1f1f1f1f1f1f1f1b2";
  const year = new Date().getFullYear();
  const number = (n, y = year) => `INV-${y}-${String(n).padStart(3, "0")}`;

  async function issue(creatorId, extra = {}) {
    const invoiceNumber = await generateInvoiceNumber(creatorId);
    return CrmInvoice.create({
      creatorId,
      invoiceNumber,
      companyName: "Acme",
      invoiceName: "Work",
      amount: 100,
      ...extra,
    });
  }

  beforeAll(async () => {
    // The parallel-request tests rely on the unique (creatorId, year) index, which
    // mongoose builds asynchronously after the model is compiled.
    await InvoiceCounter.init();
  });

  beforeEach(async () => {
    await CrmInvoice.deleteMany({ creatorId: { $in: [creatorA, creatorB] } });
    await InvoiceCounter.deleteMany({ creatorId: { $in: [creatorA, creatorB] } });
  });

  afterAll(async () => {
    await CrmInvoice.deleteMany({ creatorId: { $in: [creatorA, creatorB] } });
    await InvoiceCounter.deleteMany({ creatorId: { $in: [creatorA, creatorB] } });
  });

  describe("helpers", () => {
    it("formats and parses numbers", () => {
      expect(formatInvoiceNumber(2026, 4)).toBe("INV-2026-004");
      expect(formatInvoiceNumber(2026, 1234)).toBe("INV-2026-1234");
      expect(parseInvoiceSequence("INV-2026-004", 2026)).toBe(4);
      expect(parseInvoiceSequence("INV-2026-1234", 2026)).toBe(1234);
    });

    it("parses anything that is not an invoice number of that year as 0", () => {
      expect(parseInvoiceSequence("INV-2025-004", 2026)).toBe(0);
      expect(parseInvoiceSequence("INV-2026-ABC", 2026)).toBe(0);
      expect(parseInvoiceSequence("CUSTOM-9", 2026)).toBe(0);
      expect(parseInvoiceSequence("", 2026)).toBe(0);
      expect(parseInvoiceSequence(undefined, 2026)).toBe(0);
    });
  });

  describe("generateInvoiceNumber", () => {
    it("starts at 001 and counts up", async () => {
      const first = await issue(creatorA);
      const second = await issue(creatorA);
      const third = await issue(creatorA);

      expect([first, second, third].map((i) => i.invoiceNumber)).toEqual([number(1), number(2), number(3)]);
    });

    it("never hands out a number that is already on an existing invoice after an earlier invoice is deleted", async () => {
      const first = await issue(creatorA);
      await issue(creatorA);
      await issue(creatorA);
      await CrmInvoice.deleteMany({ _id: first._id });

      const next = await issue(creatorA);

      expect(next.invoiceNumber).toBe(number(4));
      const numbers = (await CrmInvoice.find({ creatorId: creatorA }).lean()).map((i) => i.invoiceNumber);
      expect(new Set(numbers).size).toBe(numbers.length);
    });

    it("never re-issues the number of a deleted invoice, even the newest one", async () => {
      await issue(creatorA);
      await issue(creatorA);
      const sentToClient = await issue(creatorA);
      await CrmInvoice.deleteMany({ _id: sentToClient._id });

      const next = await issue(creatorA);

      expect(sentToClient.invoiceNumber).toBe(number(3));
      expect(next.invoiceNumber).toBe(number(4));
    });

    it("gives parallel requests different numbers", async () => {
      const numbers = await Promise.all(Array.from({ length: 10 }, () => generateInvoiceNumber(creatorA)));

      expect(new Set(numbers).size).toBe(10);
      expect([...numbers].sort()).toEqual(Array.from({ length: 10 }, (_, i) => number(i + 1)));
    });

    it("continues after invoices the counter has never seen (seeded or imported numbers)", async () => {
      await CrmInvoice.create({ creatorId: creatorA, invoiceNumber: number(1), companyName: "Seed", invoiceName: "Seed", amount: 1 });
      await CrmInvoice.create({ creatorId: creatorA, invoiceNumber: number(2), companyName: "Seed", invoiceName: "Seed", amount: 1 });
      await CrmInvoice.create({ creatorId: creatorA, invoiceNumber: number(3), companyName: "Seed", invoiceName: "Seed", amount: 1 });

      expect(await generateInvoiceNumber(creatorA)).toBe(number(4));
      expect(await generateInvoiceNumber(creatorA)).toBe(number(5));
    });

    it("also skips ahead of a number typed in by hand", async () => {
      await CrmInvoice.create({ creatorId: creatorA, invoiceNumber: number(40), companyName: "Manual", invoiceName: "Manual", amount: 1 });

      expect(await generateInvoiceNumber(creatorA)).toBe(number(41));
    });

    it("keeps the sequence of one creator independent of another's", async () => {
      await issue(creatorA);
      await issue(creatorA);

      expect(await generateInvoiceNumber(creatorB)).toBe(number(1));
      expect(await generateInvoiceNumber(creatorA)).toBe(number(3));
    });

    it("restarts the sequence each calendar year", async () => {
      await issue(creatorA);
      await issue(creatorA);

      expect(await generateInvoiceNumber(creatorA, { year: year + 1 })).toBe(number(1, year + 1));
      expect(await generateInvoiceNumber(creatorA)).toBe(number(3));
    });

    it("ignores invoices whose number does not follow the pattern or belongs to another year", async () => {
      await CrmInvoice.create({ creatorId: creatorA, invoiceNumber: "CUSTOM-99", companyName: "X", invoiceName: "X", amount: 1 });
      await CrmInvoice.create({ creatorId: creatorA, invoiceNumber: number(77, year - 1), companyName: "X", invoiceName: "X", amount: 1 });
      await CrmInvoice.create({ creatorId: creatorA, invoiceNumber: `INV-${year}-ABC`, companyName: "X", invoiceName: "X", amount: 1 });

      expect(await generateInvoiceNumber(creatorA)).toBe(number(1));
    });

    it("stays correct when seeded numbers and parallel requests are mixed", async () => {
      await CrmInvoice.create({ creatorId: creatorA, invoiceNumber: number(1), companyName: "Seed", invoiceName: "Seed", amount: 1 });
      await CrmInvoice.create({ creatorId: creatorA, invoiceNumber: number(2), companyName: "Seed", invoiceName: "Seed", amount: 1 });

      const numbers = await Promise.all(Array.from({ length: 6 }, () => generateInvoiceNumber(creatorA)));

      expect(new Set(numbers).size).toBe(6);
      expect(numbers.every((n) => parseInvoiceSequence(n, year) > 2)).toBe(true);
    });
  });
});
