require("../fixtures");
const test = require("node:test");
const assert = require("node:assert/strict");
const { run } = require("./run");

const { outcomes, scores, parsedJd } = run();

test("eval: every labeled requirement is extracted from its job description", () => {
  assert.deepEqual(outcomes.filter((o) => !o.found).map((o) => `${o.jd}:${o.needle}`), []);
});

test("eval: matcher agrees with hand labels (known limitations listed explicitly)", () => {
  const bad = outcomes.filter((o) => !o.ok);
  const unexpected = bad.filter((o) => !o.known);
  assert.deepEqual(unexpected, [], "unexpected disagreements with labels");
  const agree = outcomes.filter((o) => o.ok).length;
  console.log(`# eval: ${agree}/${outcomes.length} labels agree; known limitations: ${bad.filter((o) => o.known).map((o) => `"${o.needle}" (got ${o.actual})`).join(", ") || "none"}`);
  assert.ok(agree / outcomes.length >= 0.9);
});

test("eval: score ordering is sensible - the matching resume outranks mismatched ones for each posting", () => {
  const overall = (r, j) => scores[`${r}|${j}`].overall;
  assert.ok(overall("web", "frontend") > overall("backend", "frontend"));
  assert.ok(overall("web", "frontend") > overall("data", "frontend"));
  assert.ok(overall("data", "data") > overall("web", "data"));
  assert.ok(overall("data", "data") > overall("backend", "data"));
  assert.ok(overall("backend", "backend") > overall("data", "backend"));
  assert.ok(overall("backend", "backend") > overall("web", "backend"));
});

test("eval: parser separates required from preferred correctly in all postings", () => {
  const pref = (jd) => parsedJd[jd].filter((r) => r.type === "preferred").map((r) => r.text).sort();
  assert.deepEqual(pref("frontend"), ["docker", "typescript"]);
  assert.deepEqual(pref("data"), ["machine learning", "tableau"]);
  assert.deepEqual(pref("backend"), ["aws", "kubernetes"]);
});
