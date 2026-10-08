const mongoose = require("mongoose");

/**
 * Per-creator, per-year invoice sequence. `seq` is the last number ever issued, and
 * it only moves forward: deleting an invoice never hands its number out again, which
 * a "count the invoices that exist" scheme cannot guarantee. Advanced atomically by
 * utils/invoiceNumber.js.
 */
const invoiceCounterSchema = new mongoose.Schema(
  {
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    seq: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

invoiceCounterSchema.index({ creatorId: 1, year: 1 }, { unique: true });

module.exports =
  mongoose.models.InvoiceCounter || mongoose.model("InvoiceCounter", invoiceCounterSchema);
