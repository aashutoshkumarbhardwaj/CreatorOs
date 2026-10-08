// In-memory fake of the ScheduledContent model + module injection, so the real
// service/worker code can run without mongoose/mongod.
const Module = require('module');
const path = require('path');

let seq = 0;
const rows = [];
const clone = (o) => JSON.parse(JSON.stringify(o), (k, v) => (typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) ? new Date(v) : v));
const get = (o, k) => o[k];
function matchVal(v, cond) {
  if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
    return Object.entries(cond).every(([op, arg]) => {
      switch (op) {
        case '$in': return arg.map(String).includes(String(v));
        case '$lte': return v != null && v <= arg;
        case '$gte': return v != null && v >= arg;
        case '$exists': return (v !== undefined) === arg;
        case '$not': return !matchVal(v, arg);
        default: throw new Error('op ' + op);
      }
    });
  }
  if (cond === null) return v == null;
  return String(v) === String(cond);
}
function match(doc, f) {
  return Object.entries(f).every(([k, c]) => {
    if (k === '$or') return c.some((x) => match(doc, x));
    if (k === '$and') return c.every((x) => match(doc, x));
    return matchVal(get(doc, k), c);
  });
}
function applyUpdate(doc, u) {
  const set = u.$set || (Object.keys(u).some((k) => k.startsWith('$')) ? {} : u);
  Object.assign(doc, set);
  if (u.$inc) for (const [k, v] of Object.entries(u.$inc)) doc[k] = (doc[k] || 0) + v;
  doc.updatedAt = new Date();
}
const Model = {
  rows,
  async create(d) { const doc = { _id: 'id' + ++seq, status: 'scheduled', publishAttempts: 0, publishingStartedAt: null, createdAt: new Date(), updatedAt: new Date(), ...d }; Object.defineProperty(doc, 'save', { value() { this.updatedAt = new Date(); return Promise.resolve(this); }, enumerable: false }); rows.push(doc); return doc; },
  async findOne(f) { return rows.find((r) => match(r, f)) || null; },
  async findById(id) { return rows.find((r) => r._id === id) || null; },
  find(f) { const res = rows.filter((r) => match(r, f)); const p = Promise.resolve(res); p.sort = () => ({ limit: () => Promise.resolve(res.slice(0, 2)) }); return p; },
  async findOneAndUpdate(f, u, o = {}) { const d = rows.find((r) => match(r, f)); if (!d) return null; const before = { ...d }; applyUpdate(d, u); return o.new === false ? before : d; },
  async findByIdAndUpdate(id, u, o = {}) { return Model.findOneAndUpdate({ _id: id }, u, o); },
};

const root = process.argv[2];            // project root to test
const origLoad = Module._load;
Module._load = function (req, parent, ...rest) {
  if (/model\/scheduledContent$/.test(req)) return Model;
  if (/model\/contentOs$/.test(req)) return {};
  if (req === 'node-cron') return { schedule() {} };
  return origLoad.call(this, req, parent, ...rest);
};
const { syncScheduledContent } = require(path.join(root, 'services/contentOsScheduler.js'));
const worker = require(path.join(root, 'workers/contentPublishWorker.js'));

(async () => {
  let pass = 0, fail = 0;
  const check = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '  -> ' + extra : '')); };

  // ---- Scenario 1: edit of an already-published Content OS card -----------------
  const userId = 'u1';
  const item = { _id: 'c1', title: 'Launch', description: 'Day', platform: 'instagram', scheduledAt: new Date(Date.now() - 60000), status: 'scheduled' };
  await syncScheduledContent({ userId, item });                  // user schedules
  let n = await worker.publishDueContent();                      // worker publishes
  const postId1 = rows[0].platformPostId;
  check('S1a worker published once', n === 1 && rows[0].status === 'published');
  await syncScheduledContent({ userId, item: { ...item, title: 'Launch (typo fix)' }, previousItem: item }); // unrelated edit
  check('S1b unrelated edit leaves published row published', rows[0].status === 'published', 'status=' + rows[0].status);
  n = await worker.publishDueContent();
  check('S1c nothing is re-published (no duplicate post)', n === 0 && rows[0].platformPostId === postId1, 'republished=' + n + ' attempts=' + rows[0].publishAttempts);

  // ---- Scenario 2: edit while the worker has it in flight ------------------------
  rows.length = 0;
  const item2 = { ...item, _id: 'c2' };
  await syncScheduledContent({ userId, item: item2 });
  rows[0].status = 'publishing'; rows[0].publishedBy = 'other-worker'; rows[0].publishingStartedAt = new Date(); rows[0].publishAttempts = 1;
  await syncScheduledContent({ userId, item: { ...item2, title: 'edited mid-publish' }, previousItem: item2 });
  check('S2a in-flight row not flipped back to scheduled', rows[0].status === 'publishing', 'status=' + rows[0].status);
  await syncScheduledContent({ userId, item: { ...item2, status: 'ready', scheduledAt: null } });
  check('S2b in-flight row not cancelled out from under the worker', rows[0].status === 'publishing', 'status=' + rows[0].status);

  // ---- Scenario 3: deliberate reschedule of a published item to the future -------
  rows.length = 0;
  const item3 = { ...item, _id: 'c3' };
  await syncScheduledContent({ userId, item: item3 });
  await worker.publishDueContent();
  const future = new Date(Date.now() + 3600e3);
  await syncScheduledContent({ userId, item: { ...item3, scheduledAt: future }, previousItem: item3 });
  check('S3 moving a published item to a new future time re-queues it', rows[0].status === 'scheduled' && +rows[0].scheduledAt === +future, 'status=' + rows[0].status);

  // ---- Scenario 4: exhausted lease must never be visible as scheduled ------------
  rows.length = 0;
  const old = new Date(Date.now() - worker.PUBLISH_LEASE_MS - 60000);
  await Model.create({ userId, caption: 'x', timezone: 'UTC', scheduledAt: new Date(Date.now() - 1e6), status: 'publishing', publishedBy: 'dead', publishingStartedAt: old, publishAttempts: worker.MAX_PUBLISH_ATTEMPTS });
  const seen = [];
  const realFOAU = Model.findOneAndUpdate;
  Model.findOneAndUpdate = async (...a) => { const r = await realFOAU(...a); seen.push(rows[0].status); return r; };
  const res = await worker.reclaimStalePublishingLeases();
  Model.findOneAndUpdate = realFOAU;
  check('S4a exhausted row ends failed', rows[0].status === 'failed' && res.failed === 1, JSON.stringify(res));
  check('S4b exhausted row is never exposed as "scheduled" mid-reclaim', !seen.includes('scheduled'), 'observed=' + seen.join('>'));

  // ---- Scenario 5: stale worker finishing after its lease was taken over ---------
  rows.length = 0;
  const r = await Model.create({ userId, caption: 'y', timezone: 'UTC', scheduledAt: new Date(Date.now() - 1000), status: 'scheduled' });
  // worker A claims, stalls; lease expires; worker B reclaims + claims; then A finishes late.
  const wA = worker;
  let release; const gate = new Promise((res2) => (release = res2));
  const origPublish = worker.publishToPlatform; // not patchable via exports; simulate with direct state edits instead
  const claimA = await Model.findOneAndUpdate({ status: 'scheduled' }, { $set: { status: 'publishing', publishedBy: 'worker-A', publishingStartedAt: old }, $inc: { publishAttempts: 1 } }, { new: true });
  const staleSnapshot = { ...claimA };
  await worker.reclaimStalePublishingLeases();                                   // lease expired -> scheduled
  const claimB = await Model.findOneAndUpdate({ status: 'scheduled' }, { $set: { status: 'publishing', publishedBy: 'worker-B', publishingStartedAt: new Date() }, $inc: { publishAttempts: 1 } }, { new: true });
  // A's late fenced write (same predicate finishClaim uses):
  const lateA = await Model.findOneAndUpdate({ _id: staleSnapshot._id, status: 'publishing', publishedBy: 'worker-A', publishAttempts: staleSnapshot.publishAttempts }, { $set: { status: 'published' } }, { new: true });
  check('S5 stale worker cannot overwrite the new lease owner', lateA === null && rows[0].publishedBy === 'worker-B' && rows[0].status === 'publishing');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
