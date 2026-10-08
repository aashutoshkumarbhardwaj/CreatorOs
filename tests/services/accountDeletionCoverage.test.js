const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

// Load every model so mongoose.models is complete. seedSuggestions.js is a
// standalone seeding script (it connects to a database when required), not a model.
const MODEL_DIR = path.join(__dirname, "..", "..", "model");
const NOT_MODEL_FILES = new Set(["seedSuggestions.js"]);
fs.readdirSync(MODEL_DIR)
  .filter((file) => file.endsWith(".js") && !NOT_MODEL_FILES.has(file))
  .forEach((file) => require(path.join(MODEL_DIR, file)));

const {
  USER_OWNED_MODELS,
  CREATOR_OWNED_MODELS,
} = require("../../services/accountDeletionService");

// Handled explicitly by deleteAccount itself, not through the registries.
const DELETED_EXPLICITLY = new Set(["User", "Creator"]);

function refOf(schemaType) {
  const options = schemaType.options || {};
  const item = schemaType.$embeddedSchemaType || schemaType.caster;
  return options.ref || (Array.isArray(options.type) && options.type[0]?.ref) || item?.options?.ref;
}

function referencedOwners(Model) {
  const owners = [];
  for (const [field, schemaType] of Object.entries(Model.schema.paths)) {
    const ref = refOf(schemaType);
    if (ref === "User" || ref === "Creator") owners.push({ field, ref });
  }
  return owners;
}

describe("account deletion coverage", () => {
  const covered = new Set(
    [...USER_OWNED_MODELS.map(([Model]) => Model), ...CREATOR_OWNED_MODELS].map((Model) => Model.modelName),
  );

  it("covers every model whose schema references a User or Creator", () => {
    const uncovered = Object.values(mongoose.models)
      .filter((Model) => !DELETED_EXPLICITLY.has(Model.modelName))
      .filter((Model) => referencedOwners(Model).length > 0)
      .filter((Model) => !covered.has(Model.modelName))
      .map((Model) => Model.modelName);

    // If this fails, a model holding user data is not removed by "Delete account".
    // Register it in USER_OWNED_MODELS (keyed by User _id) or CREATOR_OWNED_MODELS
    // (keyed by Creator _id) in services/accountDeletionService.js.
    expect(uncovered).toEqual([]);
  });

  it("registers each user-owned model under a field that really references User", () => {
    for (const [Model, ownerField] of USER_OWNED_MODELS) {
      const schemaType = Model.schema.path(ownerField);
      expect(`${Model.modelName}.${ownerField}:${schemaType ? refOf(schemaType) : "missing"}`).toBe(
        `${Model.modelName}.${ownerField}:User`,
      );
    }
  });

  it("registers each creator-owned model under a creatorId that references Creator", () => {
    for (const Model of CREATOR_OWNED_MODELS) {
      const schemaType = Model.schema.path("creatorId");
      expect(`${Model.modelName}.creatorId:${schemaType ? refOf(schemaType) : "missing"}`).toBe(
        `${Model.modelName}.creatorId:Creator`,
      );
    }
  });
});
