const CrmInvoice = require("../model/crmInvoice");
const InvoiceCounter = require("../model/invoiceCounter");

const MAX_ATTEMPTS = 3;

function formatInvoiceNumber(year, sequence) {
  return `INV-${year}-${String(sequence).padStart(3, "0")}`;
}

/**
 * Sequence part of an "INV-<year>-<n>" number, or 0 when it is not one for that year.
 */
function parseInvoiceSequence(invoiceNumber, year) {
  const match = new RegExp(`^INV-${year}-(\\d+)$`).exec(String(invoiceNumber || ""));
  return match ? Number(match[1]) : 0;
}

/**
 * Highest sequence already present on this creator's invoices for the year. Covers
 * numbers the counter has never seen: seeded demo invoices, imported data, and
 * numbers typed in by hand.
 */
async function highestExistingSequence(creatorId, year) {
  const rows = await CrmInvoice.find({
    creatorId,
    invoiceNumber: { $regex: `^INV-${year}-\\d+$` },
  })
    .select("invoiceNumber")
    .lean();

  return rows.reduce((highest, row) => Math.max(highest, parseInvoiceSequence(row.invoiceNumber, year)), 0);
}

const isDuplicateKey = (error) => error && error.code === 11000;

/**
 * Issue the next invoice number for a creator, e.g. "INV-2026-004".
 *
 * Numbers must be unique and must never be reused, because they are printed on
 * documents that have already left the app. Deriving them from
 * `countDocuments() + 1` fails both ways: deleting any invoice shifts the count so
 * the next number collides with one that still exists (or re-issues a deleted one),
 * and parallel requests read the same count and all get the same number.
 *
 * Here the number comes from a counter advanced with one atomic `$inc`, so
 * concurrent callers each receive a different value, and the counter is first
 * raised to the highest number already in use so it never hands out an existing one.
 */
async function generateInvoiceNumber(creatorId, { year = new Date().getFullYear() } = {}) {
  const floor = await highestExistingSequence(creatorId, year);

  if (floor > 0) {
    try {
      // Matches (or creates) the counter only while it is behind `floor`. A
      // duplicate-key error means another request created it at the same moment.
      await InvoiceCounter.updateOne(
        { creatorId, year, seq: { $lt: floor } },
        { $set: { seq: floor } },
        { upsert: true }
      );
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
    }
  }

  for (let attempt = 1; ; attempt += 1) {
    try {
      const counter = await InvoiceCounter.findOneAndUpdate(
        { creatorId, year },
        { $inc: { seq: 1 } },
        { upsert: true, new: true }
      );
      return formatInvoiceNumber(year, counter.seq);
    } catch (error) {
      // Two first-ever requests can race on the upsert; the loser simply retries.
      if (!isDuplicateKey(error) || attempt >= MAX_ATTEMPTS) throw error;
    }
  }
}

module.exports = {
  generateInvoiceNumber,
  parseInvoiceSequence,
  formatInvoiceNumber,
  highestExistingSequence,
};
