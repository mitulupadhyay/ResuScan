process.env.CLIENT_ORIGIN = "http://localhost:5173";
require("./fixtures");
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

// Run the real server.js without MongoDB: stub the DB connect and bind to a random port.
const servers = [];
const origListen = express.application.listen;
express.application.listen = function () { const s = origListen.call(this, 0); servers.push(s); return s; };
const dbPath = require.resolve("../src/config/db");
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { connectDB: async () => {} } };
require("../src/server");
test.after(() => servers.forEach((s) => s.close()));

const base = async () => {
  while (!servers.length) await new Promise((r) => setTimeout(r, 10));
  return `http://127.0.0.1:${servers[0].address().port}`;
};

test("server sends security headers and hides x-powered-by", async () => {
  const r = await fetch(`${await base()}/`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.equal(r.headers.get("x-powered-by"), null);
  assert.equal(r.headers.get("cross-origin-resource-policy"), "cross-origin");
  assert.ok(r.headers.get("strict-transport-security"));
});

test("CORS: only the configured frontend origin may make credentialed requests", async () => {
  const url = `${await base()}/api/health`;
  const ok = await fetch(url, { headers: { origin: "http://localhost:5173" } });
  assert.equal(ok.headers.get("access-control-allow-origin"), "http://localhost:5173");
  assert.equal(ok.headers.get("access-control-allow-credentials"), "true");
  const bad = await fetch(url, { headers: { origin: "https://evil.example" } });
  assert.equal(bad.headers.get("access-control-allow-origin"), null);
});

test("unknown routes return JSON 404 and protected routes need a login", async () => {
  const b = await base();
  assert.equal((await fetch(`${b}/api/nope`)).status, 404);
  assert.equal((await fetch(`${b}/api/resumes`)).status, 401);
  assert.equal((await fetch(`${b}/api/job-matches`)).status, 401);
  assert.equal((await fetch(`${b}/api/improvements/assess`, { method: "POST" })).status, 401);
});
