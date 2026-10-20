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
const { errorHandler, notFound } = require("../src/middleware/errorHandler");
const { normalizeSections } = require("../src/services/sectionsSchema");

const oid = () => new mongoose.Types.ObjectId();
const A = oid(), B = oid(), rid = oid(), v1 = oid();
const same = (x, y) => String(x) === String(y);

const versions = [{ _id: v1, resumeId: rid, versionNumber: 1, label: "V1", rawText, parsedSections: normalizeSections(parsed), sourceType: "upload" }];
const resume = { _id: rid, userId: A, currentVersionId: v1, latestVersionNumber: 1, save: async () => resume };

User.findById = async (id) => ({ _id: id });
Resume.findOne = async (q) => (same(q._id, rid) && same(q.userId, A) ? resume : null);
ResumeVersion.findOne = async (q) => versions.find((v) => same(v._id, q._id) && same(v.resumeId, q.resumeId)) || null;
ResumeVersion.create = async (d) => { const v = { ...d, _id: oid(), createdAt: new Date() }; versions.push(v); return v; };

const app = express();
app.use(express.json()); app.use(cookieParser());
app.use("/api/resumes", require("../src/routes/resume"));
app.use(notFound); app.use(errorHandler);
const server = app.listen(0);
test.after(() => server.close());
const base = () => `http://127.0.0.1:${server.address().port}/api/resumes/${rid}`;
const call = (method, path, uid, body) =>
  fetch(base() + path, { method, headers: { "content-type": "application/json", cookie: `${env.cookieName}=${signToken({ sub: String(uid) })}` }, body: body ? JSON.stringify(body) : undefined });

const edited = () => ({ ...normalizeSections(parsed), basics: { ...normalizeSections(parsed).basics, email: "asha.new@example.com" }, summary: "Corrected summary." });

test("saving corrections creates a NEW version; the original is untouched", async () => {
  const before = JSON.stringify(versions[0]);
  const r = await call("PUT", `/versions/${v1}/sections`, A, { sections: edited() });
  assert.equal(r.status, 201);
  const { version } = await r.json();
  assert.equal(version.label, "V2");
  assert.equal(version.sourceType, "edit");
  assert.equal(String(version.parentVersionId), String(v1));
  assert.match(version.rawText, /asha\.new@example\.com/); // rawText regenerated from the edit
  assert.equal(JSON.stringify(versions[0]), before);        // V1 byte-for-byte unchanged
  assert.equal(String(resume.currentVersionId), String(version._id));
});

test("saving identical content does not create a pointless version", async () => {
  const n = versions.length;
  const r = await call("PUT", `/versions/${versions[1]._id}/sections`, A, { sections: normalizeSections(versions[1].parsedSections) });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).unchanged, true);
  assert.equal(versions.length, n);
});

test("invalid edits are rejected: bad email, missing name, bad link, missing body", async () => {
  const bad = (mut) => { const s = edited(); mut(s); return s; };
  const put = (sections) => call("PUT", `/versions/${v1}/sections`, A, { sections });
  assert.equal((await put(bad((s) => { s.basics.email = "not-an-email"; }))).status, 400);
  assert.equal((await put(bad((s) => { s.basics.name = " "; }))).status, 400);
  assert.equal((await put(bad((s) => { s.basics.links = [{ label: "x", url: "javascript:alert(1)" }]; }))).status, 400);
  assert.equal((await call("PUT", `/versions/${v1}/sections`, A, {})).status, 400);
});

test("domain-only links get https:// added; empty entries are dropped", () => {
  const s = normalizeSections({ basics: { name: "A", links: [{ label: "GH", url: "github.com/a" }, { label: "", url: "" }] }, projects: [{ name: "", bullets: [""] }] });
  assert.equal(s.basics.links.length, 1);
  assert.equal(s.basics.links[0].url, "https://github.com/a");
  assert.equal(s.projects.length, 0);
});

test("another user cannot edit or restore someone else's versions", async () => {
  const n = versions.length;
  assert.equal((await call("PUT", `/versions/${v1}/sections`, B, { sections: edited() })).status, 404);
  assert.equal((await call("POST", `/versions/${v1}/restore`, B)).status, 404);
  assert.equal(versions.length, n);
});

test("restore copies the old version forward; history only grows and nothing is overwritten", async () => {
  const n = versions.length;
  const snapshot = JSON.stringify(versions);
  const r = await call("POST", `/versions/${v1}/restore`, A);
  assert.equal(r.status, 201);
  const { version, restoredFrom } = await r.json();
  assert.equal(restoredFrom, "V1");
  assert.equal(version.sourceType, "restore");
  assert.equal(version.label, `V${n + 1}`);
  assert.deepEqual(version.parsedSections, versions[0].parsedSections);
  assert.equal(version.rawText, versions[0].rawText);
  assert.equal(versions.length, n + 1);
  assert.equal(JSON.stringify(versions.slice(0, n)), snapshot); // earlier versions identical
  assert.equal(String(resume.currentVersionId), String(version._id));
});

test("restoring the version that is already current is refused", async () => {
  const cur = String(resume.currentVersionId);
  assert.equal((await call("POST", `/versions/${cur}/restore`, A)).status, 400);
});

test("unknown or malformed version ids are rejected", async () => {
  assert.equal((await call("POST", `/versions/${oid()}/restore`, A)).status, 404);
  assert.equal((await call("POST", `/versions/xyz/restore`, A)).status, 400);
});
