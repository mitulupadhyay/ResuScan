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
const Analysis = require("../src/models/Analysis");
const JobMatch = require("../src/models/JobMatch");
const { errorHandler, notFound } = require("../src/middleware/errorHandler");

const oid = () => new mongoose.Types.ObjectId();
const A = oid(), B = oid();
const same = (x, y) => String(x) === String(y);

// ---- tiny in-memory "database"
const db = { users: [{ _id: A }, { _id: B }], resumes: [], versions: [], analyses: [], matches: [] };
const mkUser = (id) => ({ _id: id, name: "T", email: "t@x.io", comparePassword: async (p) => p === "correct-horse", save: async () => {} });
User.findById = (id) => { const u = mkUser(id); const q = { select: () => q, then: (res, rej) => Promise.resolve(u).then(res, rej) }; return q; };
User.deleteOne = async ({ _id }) => { db.users = db.users.filter((u) => !same(u._id, _id)); };
Resume.create = async (d) => { const r = { ...d, _id: oid(), save: async function () { return this; } }; db.resumes.push(r); return r; };
Resume.find = (q) => { const rows = db.resumes.filter((r) => same(r.userId, q.userId)); return { select: () => ({ lean: async () => rows }) }; };
Resume.deleteMany = async (q) => { db.resumes = db.resumes.filter((r) => !same(r.userId, q.userId)); };
ResumeVersion.create = async (d) => { const v = { ...d, _id: oid() }; db.versions.push(v); return v; };
ResumeVersion.deleteMany = async (q) => { const ids = q.resumeId.$in.map(String); db.versions = db.versions.filter((v) => !ids.includes(String(v.resumeId))); };
Analysis.deleteMany = async (q) => { db.analyses = db.analyses.filter((a) => !same(a.userId, q.userId)); };
JobMatch.deleteMany = async (q) => { db.matches = db.matches.filter((m) => !same(m.userId, q.userId)); };

const app = express();
app.use(express.json()); app.use(cookieParser());
app.use("/api/auth", require("../src/routes/auth"));
app.use("/api/resumes", require("../src/routes/resume"));
app.use(notFound); app.use(errorHandler);
const server = app.listen(0);
test.after(() => server.close());
const url = (p) => `http://127.0.0.1:${server.address().port}/api${p}`;
const ck = (uid) => ({ cookie: `${env.cookieName}=${signToken({ sub: String(uid) })}` });
const upload = (bytes, type, name = "resume.docx") => {
  const fd = new FormData();
  fd.append("file", new Blob([bytes], { type }), name);
  return fetch(url("/resumes"), { method: "POST", headers: ck(A), body: fd });
};
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const fx = (f) => fs.readFileSync(path.join(__dirname, "fixtures", f));

test("DOCX upload creates a resume; text and the hyperlink URL are extracted", async () => {
  const r = await upload(fx("resume.docx"), DOCX);
  assert.equal(r.status, 201, await r.clone().text());
  const { version } = await r.json();
  assert.equal(version.sourceType, "upload");
  assert.match(version.rawText, /Asha Rao/);
  assert.match(version.rawText, /\[GitHub\]\(https:\/\/github\.com\/asha\)/);
  assert.match(version.rawText, /genetic algorithm/);
  assert.equal(db.resumes.at(-1).title, "resume"); // extension stripped
});

test("DOCX: empty, corrupted, fake-extension and wrong-type files are rejected clearly", async () => {
  const empty = await upload(fx("empty.docx"), DOCX);
  assert.equal(empty.status, 400);
  assert.match((await empty.json()).error.message, /no readable text/i);
  const corrupt = await upload(fx("corrupt.docx"), DOCX);
  assert.equal(corrupt.status, 400);
  assert.match((await corrupt.json()).error.message, /corrupted|not a real/i);
  assert.equal((await upload(Buffer.from("plain text, not zip"), DOCX)).status, 400);
  assert.equal((await upload(Buffer.from("hello"), "text/plain", "a.txt")).status, 400);
  assert.equal((await upload(Buffer.from("hello"), "application/msword", "a.doc")).status, 400);
});

test("PDF uploads still work through the same endpoint", async () => {
  const r = await upload(fx("student.pdf"), "application/pdf", "mine.pdf");
  assert.equal(r.status, 201);
  assert.equal(db.resumes.at(-1).title, "mine");
});

test("account deletion needs the right password and requires login", async () => {
  const del = (uid, password) => fetch(url("/auth/account"), { method: "DELETE", headers: { "content-type": "application/json", ...(uid ? ck(uid) : {}) }, body: JSON.stringify({ password }) });
  assert.equal((await del(null, "correct-horse")).status, 401);
  assert.equal((await del(A, "wrong")).status, 401);
  assert.ok(db.users.some((u) => same(u._id, A)));
});

test("account deletion removes only that user's data and clears the cookie", async () => {
  const rB = await Resume.create({ userId: B, title: "B resume" });
  db.versions.push({ _id: oid(), resumeId: rB._id });
  db.analyses.push({ userId: B }, { userId: A });
  db.matches.push({ userId: B }, { userId: A });
  const mine = db.resumes.filter((r) => same(r.userId, A)).map((r) => String(r._id));
  assert.ok(mine.length >= 2);

  const r = await fetch(url("/auth/account"), { method: "DELETE", headers: { "content-type": "application/json", ...ck(A) }, body: JSON.stringify({ password: "correct-horse" }) });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("set-cookie") || "", new RegExp(`${env.cookieName}=;`));

  assert.ok(!db.users.some((u) => same(u._id, A)));
  assert.ok(!db.resumes.some((x) => same(x.userId, A)));
  assert.ok(!db.versions.some((v) => mine.includes(String(v.resumeId))));
  assert.ok(!db.analyses.some((x) => same(x.userId, A)));
  assert.ok(!db.matches.some((x) => same(x.userId, A)));
  // B untouched
  assert.ok(db.users.some((u) => same(u._id, B)));
  assert.ok(db.resumes.some((x) => same(x.userId, B)));
  assert.ok(db.versions.some((v) => same(v.resumeId, rB._id)));
  assert.equal(db.analyses.filter((x) => same(x.userId, B)).length, 1);
  assert.equal(db.matches.filter((x) => same(x.userId, B)).length, 1);
});
