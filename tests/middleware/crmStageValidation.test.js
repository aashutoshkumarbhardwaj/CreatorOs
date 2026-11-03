/**
 * Regression tests for BUG-003: CRM Deal Stage Validation Mismatch
 *
 * Root cause: validateDeal in creatorCrmValidator.js allowed stages
 *   ['lead','contacted','negotiating','contract_sent','signed','delivering','completed','paid','lost']
 * but model/crmDeal.js enum was:
 *   ['lead','outreach','negotiation','contract','closed_won','closed_lost']
 * Only 'lead' overlapped. The frontend and analytics both used the model's values.
 *
 * Fix: Align validateDeal.isIn() with the canonical model enum.
 */
const { validateDeal } = require("../../middleware/validators/creatorCrmValidator");
const CrmDeal = require("../../model/crmDeal");

const VALID_MODEL_STAGES = ["lead", "outreach", "negotiation", "contract", "closed_won", "closed_lost"];
const INVALID_OLD_VALIDATOR_STAGES = ["contacted", "negotiating", "contract_sent", "signed", "delivering", "completed", "paid", "lost"];
const INVALID_STAGES = ["pending", "approved", "rejected", "unknown", "archive"];

/**
 * Helper: run validateDeal middleware against a given stage and return HTTP status code.
 * Returns 200 if validation passes (next() called), 4xx if rejected.
 */
function runValidateDeal(stage) {
  return new Promise((resolve) => {
    const req = {
      body: { dealName: "Test Deal", stage },
      get: () => "application/json",
    };
    const res = {
      statusCode: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json() {
        resolve(this.statusCode);
        return this;
      },
    };
    const next = () => resolve(200);
    validateDeal(req, res, next);
  });
}

describe("BUG-003 Regression: CRM deal stage validation", () => {
  describe("Valid model stages must pass validator", () => {
    VALID_MODEL_STAGES.forEach((stage) => {
      it(`stage '${stage}' passes validateDeal`, async () => {
        const status = await runValidateDeal(stage);
        expect(status).toBe(200);
      });
    });
  });

  describe("Valid model stages must pass Mongoose schema enum", () => {
    VALID_MODEL_STAGES.forEach((stage) => {
      it(`stage '${stage}' is accepted by CrmDeal schema`, () => {
        const deal = new CrmDeal({
          creatorId: "60d5ecb8b5c9c22b1c8e1111",
          dealName: "Test Deal",
          stage,
        });
        const err = deal.validateSync();
        const stageErr = err && err.errors && err.errors.stage ? err.errors.stage.message : null;
        expect(stageErr).toBeNull();
      });
    });
  });

  describe("Old validator-only stages must now be rejected by validateDeal", () => {
    INVALID_OLD_VALIDATOR_STAGES.forEach((stage) => {
      it(`old stage '${stage}' is now rejected by validateDeal`, async () => {
        const status = await runValidateDeal(stage);
        // Should return 400 or 422 (validation error)
        expect([400, 422]).toContain(status);
      });
    });
  });

  describe("Genuinely invalid stages must be rejected by both validator and Mongoose", () => {
    INVALID_STAGES.forEach((stage) => {
      it(`invalid stage '${stage}' is rejected by validateDeal`, async () => {
        const status = await runValidateDeal(stage);
        expect([400, 422]).toContain(status);
      });

      it(`invalid stage '${stage}' is rejected by CrmDeal schema`, () => {
        const deal = new CrmDeal({
          creatorId: "60d5ecb8b5c9c22b1c8e1111",
          dealName: "Test Deal",
          stage,
        });
        const err = deal.validateSync();
        expect(err && err.errors && err.errors.stage).toBeTruthy();
      });
    });
  });

  describe("Consistency: validator and schema agree on valid stages", () => {
    it("every stage accepted by validateDeal is also valid in the Mongoose schema", async () => {
      for (const stage of VALID_MODEL_STAGES) {
        const validatorStatus = await runValidateDeal(stage);
        expect(validatorStatus).toBe(200);

        const deal = new CrmDeal({
          creatorId: "60d5ecb8b5c9c22b1c8e1111",
          dealName: "Test Deal",
          stage,
        });
        const err = deal.validateSync();
        const stageErr = err && err.errors && err.errors.stage ? err.errors.stage.message : null;
        expect(stageErr).toBeNull();
      }
    });

    it("omitting stage is allowed (optional field)", async () => {
      const status = await runValidateDeal(undefined);
      expect(status).toBe(200);
    });
  });
});

