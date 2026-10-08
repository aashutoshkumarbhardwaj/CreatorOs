// Verification-only helper (NOT part of the PR): FerretDB's SQLite backend does not apply
// conditional updates atomically under concurrency, unlike real MongoDB. Serialize just the
// conditional-update calls so each behaves like MongoDB's atomic single-document update, while
// plain reads (findOne/findById) still interleave freely between them.
const path = "/home/claude/p3/CreatorOs/model/digitalProduct";
const { DigitalProduct, DigitalOrder } = require(path);
let chain = Promise.resolve();
for (const Model of [DigitalProduct, DigitalOrder]) {
  for (const name of ["findOneAndUpdate", "updateOne"]) {
    const orig = Model[name].bind(Model);
    Model[name] = (...args) => {
      const run = () => orig(...args).exec();
      const p = chain.then(run, run);
      chain = p.catch(() => {});
      return p;
    };
  }
}
