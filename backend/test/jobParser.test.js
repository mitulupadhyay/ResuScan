require("./fixtures");
const test = require("node:test");
const assert = require("node:assert/strict");
const { parseJobDescription, heuristicParse, sanitizeAi } = require("../src/services/jobParser");

const JD = `Software Engineer Intern
About us: we build tools.

Responsibilities
- Build REST APIs with Node.js and Express
- Collaborate with designers on UI

Requirements
- Pursuing a B.Tech in Computer Science
- Strong knowledge of JavaScript and SQL
- 1+ years of project experience

Nice to have
- Docker
- Experience with React is a plus`;

test("heuristic parser splits required / preferred / responsibility and finds skills", () => {
  const reqs = heuristicParse(JD);
  const find = (t) => reqs.find((r) => r.text.toLowerCase() === t);
  assert.equal(find("javascript").type, "required");
  assert.equal(find("sql").type, "required");
  assert.equal(find("docker").type, "preferred");
  assert.equal(find("react").type, "preferred");
  assert.ok(reqs.some((r) => r.category === "education"));
  assert.ok(reqs.some((r) => r.category === "experience"));
  assert.ok(reqs.some((r) => r.type === "responsibility"));
});

test("every extracted requirement keeps its supporting sentence from the JD", () => {
  for (const r of heuristicParse(JD)) assert.ok(JD.includes(r.sourceSentence), r.text);
});

test("a skill named in both sections is deduped and required wins", () => {
  const reqs = heuristicParse("Requirements\n- Docker\nNice to have\n- Docker");
  const d = reqs.filter((r) => r.skill === "docker");
  assert.equal(d.length, 1);
  assert.equal(d[0].type, "required");
});

test("AI output: ungrounded sourceSentence is flagged for review, not trusted", () => {
  const out = sanitizeAi(
    { requirements: [
      { text: "docker", type: "required", category: "skill", skill: "Docker", sourceSentence: "Docker" },
      { text: "Kubernetes", type: "required", category: "skill", skill: "k8s", sourceSentence: "This sentence is not in the posting" },
    ] },
    "Requirements\n- Docker\n"
  );
  assert.equal(out.find((r) => r.skill === "docker").needsReview, false);
  const k = out.find((r) => r.skill === "kubernetes");
  assert.equal(k.needsReview, true);
  assert.equal(k.sourceSentence, "");
});

test("AI failure falls back to the built-in parser with a warning", async () => {
  const out = await parseJobDescription(JD, { callAi: async () => { throw new Error("503"); } });
  assert.equal(out.parsedBy, "heuristic");
  assert.match(out.warning, /unavailable/);
  assert.ok(out.requirements.length > 3);
});

test("malformed AI JSON and empty AI results fall back too", async () => {
  const bad = await parseJobDescription(JD, { callAi: async () => ({ text: "not json" }) });
  const empty = await parseJobDescription(JD, { callAi: async () => ({ text: JSON.stringify({ jobTitle: "x", seniority: "", requirements: [] }) }) });
  assert.equal(bad.parsedBy, "heuristic");
  assert.equal(empty.parsedBy, "heuristic");
});

test("valid AI output is used", async () => {
  const out = await parseJobDescription(JD, {
    callAi: async () => ({ text: JSON.stringify({ jobTitle: "SWE Intern", seniority: "intern", requirements: [{ text: "javascript", type: "required", category: "skill", skill: "JS", sourceSentence: "Strong knowledge of JavaScript and SQL" }] }) }),
  });
  assert.equal(out.parsedBy, "ai");
  assert.equal(out.requirements[0].skill, "javascript");
  assert.equal(out.seniority, "intern");
});

test("text with no recognizable requirements yields none (route turns this into a 400)", async () => {
  assert.deepEqual(heuristicParse("Hello there. We are a friendly company that likes snacks and sunshine."), []);
});
