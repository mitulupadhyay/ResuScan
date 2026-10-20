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
const gemini = require("../src/services/geminiService");
const { normalizeSections } = require("../src/services/sectionsSchema");
const { errorHandler, notFound } = require("../src/middleware/errorHandler");

process.env.GEMINI_API_KEY = "test-key";
const oid = () => new mongoose.Types.ObjectId();
const A = oid(), B = oid(), rid = oid(), v1 = oid();
const same = (x, y) => String(x) === String(y);
const versions = [{ _id: v1, resumeId: rid, versionNumber: 1, label: "V1", rawText, parsedSections: normalizeSections(parsed), sourceType: "upload" }];
const resume = { _id: rid, userId: A, currentVersionId: v1, latestVersionNumber: 1, save: async () => resume };
User.findById = async (id) => ({ _id: id });
Resume.findOne = async (q) => (same(q._id, rid) && same(q.userId, A) ? resume : null);
ResumeVersion.findOne = async (q) => versions.find((v) => same(v._id, q._id) && same(v.resumeId, q.resumeId)) || null;
ResumeVersion.create = async (d) => { const v = { ...d, _id: oid() }; versions.push(v); return v; };

let aiCalls = 0, aiReply;
gemini.callGemini = async () => { aiCalls++; if (aiReply instanceof Error) throw aiReply; return { text: JSON.stringify(aiReply) }; };

const app = express();
app.use(express.json()); app.use(cookieParser());
app.use("/api/improvements", require("../src/routes/improve"));
app.use(notFound); app.use(errorHandler);
const server = app.listen(0);
test.after(() => server.close());
const call = (path, uid, body) =>
  fetch(`http://127.0.0.1:${server.address().port}/api/improvements${path}`, { method: "POST", headers: { "content-type": "application/json", cookie: `${env.cookieName}=${signToken({ sub: String(uid) })}` }, body: JSON.stringify(body) });

const target = { resumeId: String(rid), itemType: "project", itemIndex: 0 };
const detailed = { contribution: "I implemented the REST endpoints and the timetable clash checker myself", technologies: "Node.js, Express.js", details: "Endpoints validate input and return conflict-free timetables as JSON" };

test("assess prefills from the resume and asks follow-ups for vague input (no AI call)", async () => {
  const r = await call("/assess", A, { ...target, facts: { contribution: "worked on a web project" } });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.item.name, "ChronoGen");
  assert.equal(j.ready, false);
  assert.ok(j.questions.some((q) => q.key === "contribution" && q.blocking));
  assert.equal(aiCalls, 0);
});

test("generate refuses vague input with questions and does not call the AI", async () => {
  const r = await call("/generate", A, { ...target, facts: { contribution: "worked on a web project" } });
  assert.equal(r.status, 409);
  assert.ok((await r.json()).error.details.questions.length);
  assert.equal(aiCalls, 0);
});

test("rejecting suggestions changes nothing: generate never writes a version", async () => {
  aiReply = { bullets: [{ text: "Implemented REST endpoints with Express.js that return conflict-free timetables", supportedBy: ["contribution", "details"] }], questions: [] };
  const before = JSON.stringify(versions);
  const r = await call("/generate", A, { ...target, facts: detailed });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).bullets.length, 1);
  assert.equal(JSON.stringify(versions), before);
});

test("AI provider failure -> 502, nothing saved", async () => {
  aiReply = new Error("boom");
  const r = await call("/generate", A, { ...target, facts: detailed });
  assert.equal(r.status, 502);
  assert.equal(versions.length, 1);
});

test("accepting saves a NEW version with the chosen bullets; the original is untouched", async () => {
  const before = JSON.stringify(versions[0]);
  const bullet = "Implemented REST endpoints with Express.js that return conflict-free timetables";
  const r = await call("/apply", A, { ...target, facts: detailed, bullets: [bullet], mode: "replace" });
  assert.equal(r.status, 201);
  const { version } = await r.json();
  assert.equal(version.label, "V2");
  assert.equal(String(version.parentVersionId), String(v1));
  assert.deepEqual(version.parsedSections.projects[0].bullets, [bullet]);
  assert.match(version.rawText, /conflict-free timetables/);
  assert.equal(JSON.stringify(versions[0]), before);
  assert.equal(String(resume.currentVersionId), String(version._id));
});

test("apply re-checks user-edited bullets: invented metric/technology is rejected, nothing saved", async () => {
  const n = versions.length;
  for (const bad of ["Reduced timetable clashes by 90% using Express.js", "Built the scheduler with PostgreSQL and Express.js endpoints"]) {
    const r = await call("/apply", A, { ...target, itemIndex: 0, versionId: String(v1), facts: detailed, bullets: [bad] });
    assert.equal(r.status, 400, bad);
  }
  assert.equal(versions.length, n);
});

test("append mode keeps existing bullets", async () => {
  const r = await call("/apply", A, { ...target, versionId: String(v1), facts: detailed, bullets: ["Implemented REST endpoints with Express.js"], mode: "append" });
  const { version } = await r.json();
  assert.equal(version.parsedSections.projects[0].bullets.length, 3);
});

test("other users, bad indexes and bad input are rejected", async () => {
  const n = versions.length;
  assert.equal((await call("/assess", B, target)).status, 404);
  assert.equal((await call("/apply", B, { ...target, facts: detailed, bullets: ["Implemented REST endpoints with Express.js"] })).status, 404);
  assert.equal((await call("/assess", A, { ...target, itemIndex: 9 })).status, 404);
  assert.equal((await call("/apply", A, { ...target, facts: detailed, bullets: [] })).status, 400);
  assert.equal((await call("/assess", A, { ...target, itemType: "hobby" })).status, 400);
  assert.equal(versions.length, n);
});
