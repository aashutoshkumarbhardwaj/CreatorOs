// Verification-only: FerretDB(SQLite) does not make conditional updates atomic under concurrency.
// Serialize only conditional-update calls (as MongoDB guarantees per document); reads stay concurrent.
const DmDelivery = require("/home/claude/p4/CreatorOs/model/dmDelivery");
let chain = Promise.resolve();
for (const name of ["findOneAndUpdate"]) {
  const orig = DmDelivery[name].bind(DmDelivery);
  DmDelivery[name] = (...args) => {
    const run = () => orig(...args).exec();
    const p = chain.then(run, run);
    chain = p.catch(() => {});
    return p;
  };
}
