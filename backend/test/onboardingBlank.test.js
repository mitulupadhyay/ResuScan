const { parsed, rawText } = require("./fixtures");
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const mongoose = require("mongoose");
const express = require("express");
const cookieParser = require("cookie-parser");

const env = require("../src/config/env");
const { signToken } = require("../src/utils/jwt");
const User = require("../src/models/user");
const Resume = require("../src/models/Resume");
const ResumeVersion = require("../src/models/ResumeVersion");
const { normalizeSections } = require("../src/services/sectionsSchema");
const { errorHandler, notFound } = require("../src/middleware/errorHandler");

const oid = () => new mongoose.Types.ObjectId();
const A = oid(), B = oid(), rid = oid(), v1 = oid();
const same = (x, y) => String(x) === String(y);
const userA = { _id: A, name: "Asha Rao", email: "asha@example.com", onboarding: {}, save: async () => userA };
const versions = [{ _id: v1, resumeId: rid, versionNumber: 1, label: "V1", rawText, parsedSections: normalizeSections(parsed), sourceType: "upload" }];
const resumes = [];
const resume = { _id: rid, userId: A, currentVersionId: v1, latestVersionNumber: 1, save: async () => resume };

User.findById = async (id) => (same(id, A) ? userA : { _id: id, save: async () => {} });
Resume.findOne = async (q) => (same(q._id, rid) && same(q.userId, A) ? resume : null);
Resume.create = async (d) => { const r = { ...d, _id: oid(), save: async function () { return this; } }; resumes.push(r); return r; };
ResumeVersion.findOne = async (q) => versions.find((v) => same(v._id, q._id) && same(v.resumeId, q.resumeId)) || null;
ResumeVersion.create = async (d) => { const v = { ...d, _id: oid() }; versions.push(v); return v; };

const app = express();
app.use(express.json()); app.use(cookieParser());
app.use("/api/auth", require("../src/routes/auth"));
app.use("/api/resumes", require("../src/routes/resume"));
app.use(notFound); app.use(errorHandler);
const server = app.listen(0);
test.after(() => server.close());
const url = (p) => `http://127.0.0.1:${server.address().port}/api${p}`;
const ck = (uid) => ({ cookie: `${env.cookieName}=${signToken({ sub: String(uid) })}` });
const json = (method, p, uid, body) => fetch(url(p), { method, headers: { "content-type": "application/json", ...(uid ? ck(uid) : {}) }, body: body ? JSON.stringify(body) : undefined });
const upload = (p, uid, bytes, type = "application/pdf") => {
  const fd = new FormData();
  fd.append("file", new Blob([bytes], { type }), "resume.pdf");
  return fetch(url(p), { method: "POST", headers: ck(uid), body: fd });
};

const good = { targetRole: "Full-Stack Developer", experienceLevel: "academic_projects", goal: "tailor", jobDescription: "" };

test("onboarding saves preferences for the logged-in user and is editable later", async () => {
  assert.equal((await json("PUT", "/auth/onboarding", null, good)).status, 401);
  const r = await json("PUT", "/auth/onboarding", A, good);
  assert.equal(r.status, 200);
  assert.equal(userA.onboarding.targetRole, "Full-Stack Developer");
  assert.equal(userA.onboarding.goal, "tailor");
  const first = userA.onboarding.completedAt;
  assert.ok(first);
  await json("PUT", "/auth/onboarding", A, { ...good, targetRole: "Backend Developer", goal: "analyze" });
  assert.equal(userA.onboarding.targetRole, "Backend Developer");
  assert.equal(userA.onboarding.completedAt, first); // completion date preserved on edit
});

test("onboarding rejects bad input", async () => {
  for (const bad of [{ ...good, targetRole: "x" }, { ...good, goal: "hack" }, { ...good, experienceLevel: "" }, { ...good, jobDescription: "x".repeat(15001) }, {}]) {
    assert.equal((await json("PUT", "/auth/onboarding", A, bad)).status, 400);
  }
});

test("start from scratch: creates an editable blank resume without any upload", async () => {
  const r = await json("POST", "/resumes/blank", A, {});
  assert.equal(r.status, 201);
  const { resume: res, version } = await r.json();
  assert.equal(String(res.userId), String(A));
  assert.equal(version.label, "V1");
  assert.equal(version.sourceType, "edit");
  assert.equal(version.parsedSections.basics.name, "Asha Rao");
  assert.equal(version.parsedSections.basics.email, "asha@example.com");
  assert.equal(version.parsedSections.projects.length, 0);
  assert.equal((await json("POST", "/resumes/blank", null, {})).status, 401);
});

const pdf = (f) => fs.readFileSync(path.join(__dirname, "fixtures", f));

test("validate-export: owner gets a report; stores nothing", async () => {
  const n = versions.length;
  // the fixture was built from a different resume, so expect a real report with differences, not a crash
  const r = await upload(`/resumes/${rid}/versions/${v1}/validate-export`, A, pdf("student.pdf"));
  assert.equal(r.status, 200);
  const { report } = await r.json();
  assert.ok(Array.isArray(report.checks) && typeof report.fidelity === "number");
  assert.equal(versions.length, n);
});

test("validate-export: other user 404; image-only PDF reported; non-PDF and fake PDFs rejected", async () => {
  const p = `/resumes/${rid}/versions/${v1}/validate-export`;
  assert.equal((await upload(p, B, pdf("student.pdf"))).status, 404);
  const img = await (await upload(p, A, pdf("image-only.pdf"))).json();
  assert.equal(img.report.ok, false);
  assert.equal(img.report.checks[0].status, "fail");
  assert.equal((await upload(p, A, Buffer.from("hello"), "text/plain")).status, 400);
  assert.equal((await upload(p, A, Buffer.from("this is not a pdf at all"), "application/pdf")).status, 400);
  assert.equal((await upload(p, A, Buffer.alloc(5 * 1024 * 1024 + 10, 37), "application/pdf")).status, 400);
});

test("uploading a scanned/image-only PDF as a resume explains the OCR limitation", async () => {
  const r = await upload("/resumes", A, pdf("image-only.pdf"));
  assert.equal(r.status, 400);
  assert.match((await r.json()).error.message, /OCR is not supported/i);
});
