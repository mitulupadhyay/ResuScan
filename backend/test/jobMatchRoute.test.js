const { parsed, rawText } = require("./fixtures");
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const express = require("express");
const cookieParser = require("cookie-parser");

const env = require("../src/config/env");
const { signToken } = require("../src/utils/jwt");
const User = require("../src/models/user");
const Resume = require("../src/models/Resume");
const ResumeVersion = require("../src/models/ResumeVersion");
const JobMatch = require("../src/models/JobMatch");
const { errorHandler, notFound } = require("../src/middleware/errorHandler");

const oid = () => new mongoose.Types.ObjectId();
const A = oid(), B = oid(), resumeA = oid(), versionA = oid();
const sameId = (x, y) => String(x) === String(y);

// ---- in-memory stand-ins for the database (no network, no real Mongo)
const store = [];
User.findById = async (id) => ({ _id: id });
Resume.findOne = async (q) => (sameId(q._id, resumeA) && sameId(q.userId, A) ? { _id: resumeA, userId: A, currentVersionId: versionA } : null);
ResumeVersion.findOne = async (q) => (sameId(q._id, versionA) ? { _id: versionA, resumeId: resumeA, parsedSections: parsed, rawText } : null);
JobMatch.create = async (d) => {
  const doc = { ...d, _id: oid(), requirements: d.requirements.map((r) => ({ ...r, toObject() { const { toObject, ...rest } = this; return rest; } })) };
  doc.save = async () => doc; doc.markModified = () => {}; doc.deleteOne = async () => store.splice(store.indexOf(doc), 1);
  store.push(doc);
  return doc;
};
JobMatch.findOne = async (q) => store.find((m) => sameId(m._id, q._id) && sameId(m.userId, q.userId)) || null;

const app = express();
app.use(express.json()); app.use(cookieParser());
app.use("/api/job-matches", require("../src/routes/jobMatch"));
app.use(notFound); app.use(errorHandler);

let base;
const server = app.listen(0);
base = `http://127.0.0.1:${server.address().port}/api/job-matches`;
test.after(() => server.close());

const cookie = (uid) => `${env.cookieName}=${signToken({ sub: String(uid) })}`;
const call = (method, path, uid, body) =>
  fetch(base + path, { method, headers: { "content-type": "application/json", ...(uid ? { cookie: cookie(uid) } : {}) }, body: body ? JSON.stringify(body) : undefined });

const JD = "Software Engineer Intern\n\nRequirements\n- Strong knowledge of JavaScript and SQL\n- Experience with Docker\n- Pursuing a B.Tech in Computer Science\n\nNice to have\n- React is a plus\n- Familiarity with Express.js";
let matchId;

test("unauthenticated requests are rejected", async () => {
  assert.equal((await call("GET", `/${oid()}`)).status, 401);
  assert.equal((await call("POST", "/", null, { resumeId: String(resumeA), jobDescription: JD })).status, 401);
});

test("owner can create a job match from a real JD (no AI key => built-in parser)", async () => {
  const r = await call("POST", "/", A, { resumeId: String(resumeA), jobDescription: JD });
  assert.equal(r.status, 201);
  const { match } = await r.json();
  matchId = String(match._id);
  assert.equal(match.parsedBy, "heuristic");
  const by = (s) => match.results.find((x) => x.requirementId === match.requirements.find((q) => q.text === s).id);
  assert.equal(by("javascript").status, "matched");
  assert.equal(by("docker").status, "not_evidenced");
  assert.equal(by("sql").status, "not_evidenced"); // MySQL is related, but not evidence of "SQL" by itself
  assert.equal(typeof match.score.overall, "number");
  assert.ok(match.score.limitations.length >= 3);
});

test("another user cannot create a match against someone else's resume", async () => {
  assert.equal((await call("POST", "/", B, { resumeId: String(resumeA), jobDescription: JD })).status, 404);
});

test("another user cannot read, edit or delete the match", async () => {
  assert.equal((await call("GET", `/${matchId}`, B)).status, 404);
  assert.equal((await call("PATCH", `/${matchId}/requirements/r1`, B, { clarification: "dont_have" })).status, 404);
  assert.equal((await call("DELETE", `/${matchId}`, B)).status, 404);
  assert.equal((await call("GET", `/${matchId}`, A)).status, 200); // still intact for the owner
});

test("malformed input is rejected: short JD, bad ids, bad clarification", async () => {
  assert.equal((await call("POST", "/", A, { resumeId: String(resumeA), jobDescription: "too short" })).status, 400);
  assert.equal((await call("POST", "/", A, { resumeId: "nope", jobDescription: JD })).status, 400);
  assert.equal((await call("GET", "/not-an-id", A)).status, 400);
  assert.equal((await call("PATCH", `/${matchId}/requirements/r1`, A, { clarification: "maybe" })).status, 400);
});

test("a JD with no recognizable requirements gives a helpful 400, not a fake report", async () => {
  const r = await call("POST", "/", A, { resumeId: String(resumeA), jobDescription: "We are a friendly team that loves sunshine, snacks and long walks on the beach every single weekend. Join us today and enjoy the vibes." });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error.message, /couldn't find any requirements/i);
});

test("owner's clarification turns an unknown gap into a confirmed gap (score unchanged)", async () => {
  const before = (await (await call("GET", `/${matchId}`, A)).json()).match;
  const docker = before.requirements.find((q) => q.text === "docker");
  const r = await call("PATCH", `/${matchId}/requirements/${docker.id}`, A, { clarification: "dont_have" });
  assert.equal(r.status, 200);
  const after = (await r.json()).match;
  const res = after.results.find((x) => x.requirementId === docker.id);
  assert.equal(res.gapType, "confirmed_gap");
  assert.equal(res.status, "not_evidenced");
  assert.equal(after.score.overall, before.score.overall);
});

test("owner can remove a wrongly extracted requirement; score is recomputed", async () => {
  const m = (await (await call("GET", `/${matchId}`, A)).json()).match;
  const n = m.requirements.length;
  const r = await call("PATCH", `/${matchId}/requirements/${m.requirements[0].id}`, A, { remove: true });
  assert.equal((await r.json()).match.requirements.length, n - 1);
});
