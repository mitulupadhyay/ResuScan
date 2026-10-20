const test = require("node:test");
const assert = require("node:assert/strict");
const { parsed, rawText, req } = require("./fixtures");
const { matchRequirements, buildEvidenceUnits } = require("../src/services/matcher");

const run = (r) => matchRequirements([r], parsed, rawText)[0];

test("skill used in a project is Matched, with quoted evidence from the resume", () => {
  const res = run(req({ skill: "express.js", text: "express.js" }));
  assert.equal(res.status, "matched");
  assert.equal(res.evidence[0].kind, "applied");
  assert.match(res.evidence[0].section, /^Projects/);
});

test("evidence text always comes from the real resume content", () => {
  const units = buildEvidenceUnits(parsed, rawText).map((u) => u.text);
  for (const skill of ["javascript", "express.js", "mysql", "python"]) {
    const res = run(req({ skill, text: skill }));
    for (const e of res.evidence) assert.ok(units.some((u) => u.startsWith(e.text.replace(/…$/, ""))), `fabricated evidence for ${skill}`);
  }
});

test("skill only listed in Skills is Partially Demonstrated", () => {
  const res = run(req({ skill: "mysql", text: "mysql" }));
  assert.equal(res.status, "partial");
  assert.equal(res.gapType, "missing_evidence");
});

test("absent skill is Not Evidenced and the gap is 'unknown', not a confirmed gap", () => {
  const res = run(req({ skill: "docker", text: "docker" }));
  assert.equal(res.status, "not_evidenced");
  assert.equal(res.gapType, "unknown");
  assert.deepEqual(res.evidence, []);
});

test("related-only skill is NOT evidence: Not Evidenced, no credit, but the reason mentions the related skill", () => {
  const res = run(req({ skill: "typescript", text: "typescript" }));
  assert.equal(res.status, "not_evidenced");
  assert.deepEqual(res.evidence, []);
  assert.match(res.reason, /related skill "javascript"/i);
  assert.equal(res.gapType, "unknown");
});

test("clarification separates missing evidence from a confirmed gap", () => {
  const have = run(req({ skill: "docker", text: "docker", clarification: "have_skill" }));
  const dont = run(req({ skill: "docker", text: "docker", clarification: "dont_have" }));
  assert.equal(have.gapType, "missing_evidence");
  assert.equal(dont.gapType, "confirmed_gap");
  assert.equal(have.status, "not_evidenced"); // answering never fabricates evidence
  assert.equal(dont.status, "not_evidenced");
});

test("ambiguous requirements: years of experience -> Needs Review", () => {
  const res = run(req({ category: "experience", text: "2+ years of professional backend experience" }));
  assert.equal(res.status, "needs_review");
});

test("education requirement is matched against the education entry", () => {
  const res = run(req({ category: "education", text: "Pursuing a Bachelor's degree in Computer Science" }));
  assert.equal(res.status, "matched");
  assert.equal(res.evidence[0].section, "Education");
});

test("prose requirement: strong overlap matched, no overlap not evidenced", () => {
  assert.equal(run(req({ category: "responsibility", type: "responsibility", text: "Build REST APIs with Express.js for timetables" })).status, "matched");
  assert.equal(run(req({ category: "responsibility", type: "responsibility", text: "Lead quarterly marketing campaigns for enterprise accounts" })).status, "not_evidenced");
});

test("matching is deterministic", () => {
  const rs = [req({ skill: "mysql", text: "mysql" }), req({ id: "r2", skill: "docker", text: "docker" })];
  assert.deepEqual(matchRequirements(rs, parsed, rawText), matchRequirements(rs, parsed, rawText));
});
