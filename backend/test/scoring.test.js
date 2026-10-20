const test = require("node:test");
const assert = require("node:assert/strict");
const { parsed, rawText, req } = require("./fixtures");
const { matchRequirements } = require("../src/services/matcher");
const { scoreMatch, SCORING_VERSION } = require("../src/services/scoring");

const score = (reqs) => scoreMatch(reqs, matchRequirements(reqs, parsed, rawText), parsed);

test("same inputs => identical score, versioned", () => {
  const reqs = [req({ skill: "express.js", text: "express.js" }), req({ id: "r2", skill: "docker", text: "docker" })];
  assert.deepEqual(score(reqs), score(reqs));
  assert.equal(score(reqs).version, SCORING_VERSION);
});

test("formula: coverage = weighted credit (matched=1, not_evidenced=0)", () => {
  const s = score([
    req({ skill: "express.js", text: "express.js", type: "required" }),   // matched, w3
    req({ id: "r2", skill: "docker", text: "docker", type: "required" }), // not evidenced, w3
  ]);
  assert.equal(s.requirementCoverage, 50);
  assert.equal(s.counts.matched, 1);
});

test("missing a required skill hurts more than missing a preferred one", () => {
  const base = [req({ skill: "express.js", text: "express.js" })];
  const missReq = score([...base, req({ id: "r2", skill: "docker", text: "docker", type: "required" })]);
  const missPref = score([...base, req({ id: "r2", skill: "docker", text: "docker", type: "preferred" })]);
  assert.ok(missPref.requirementCoverage > missReq.requirementCoverage);
  assert.ok(missPref.overall > missReq.overall);
});

test("overall = weighted combination of the three separate dimensions", () => {
  const s = score([req({ skill: "express.js", text: "express.js" })]);
  assert.equal(s.overall, Math.round(0.6 * s.requirementCoverage + 0.25 * s.evidenceStrength + 0.15 * s.documentQuality));
});

test("listed-only skill gives less evidence strength than a demonstrated one", () => {
  const demo = score([req({ skill: "express.js", text: "express.js" })]);
  const listed = score([req({ skill: "mysql", text: "mysql" })]);
  assert.ok(demo.evidenceStrength > listed.evidenceStrength);
});

test("priorities list required gaps first and carry an action", () => {
  const s = score([
    req({ id: "r1", skill: "docker", text: "docker", type: "preferred" }),
    req({ id: "r2", skill: "aws", text: "aws", type: "required" }),
  ]);
  assert.equal(s.priorities[0].requirementId, "r2");
  assert.ok(s.priorities[0].action.length > 10);
});

test("no requirements => overall is null; limitations always present and deny ATS claims", () => {
  const s = score([]);
  assert.equal(s.overall, null);
  assert.match(s.limitations[0], /not a score from any employer/i);
});
