require("./fixtures");
const test = require("node:test");
const assert = require("node:assert/strict");
const imp = require("../src/services/bulletImprover");

const item = { type: "project", index: 0, name: "ChronoGen", tech: ["JavaScript"], bullets: ["Built timetable generator"] };
const full = imp.mergeFacts(item, {
  contribution: "I wrote the genetic algorithm scheduler and the room-clash constraint checker myself",
  technologies: "JavaScript, Node.js",
  details: "Each timetable is a chromosome; fitness penalises clashes between rooms and faculty",
});

test("vague description triggers blocking follow-up questions instead of generation", () => {
  const a = imp.assessFacts(imp.mergeFacts({ ...item, tech: [] }, { contribution: "I worked on a web development project" }));
  assert.equal(a.ready, false);
  const keys = a.questions.filter((q) => q.blocking).map((q) => q.key);
  assert.deepEqual(keys.sort(), ["contribution", "details", "technologies"]);
});

test("specific facts are ready; missing results is a non-blocking question", () => {
  const a = imp.assessFacts(full);
  assert.equal(a.ready, true);
  assert.ok(a.questions.some((q) => q.key === "results" && !q.blocking));
});

test("facts are prefilled from the resume item, and user input overrides", () => {
  assert.equal(imp.mergeFacts(item).technologies, "JavaScript");
  assert.equal(imp.mergeFacts(item, { technologies: "Go" }).technologies, "Go");
});

const corpus = imp.buildCorpus(full, item);
test("claim checker: invented numbers, technologies, leadership, scale and impact are flagged", () => {
  const f = (t, o) => imp.findUnsupportedClaims(t, corpus, o);
  assert.deepEqual(f("Built a scheduler in JavaScript using a genetic algorithm"), []);
  assert.match(f("Cut scheduling time by 85%").join(), /85/);
  assert.match(f("Built the API with PostgreSQL").join(), /postgresql/i);
  assert.match(f("Led a team to build the scheduler").join(), /Led/i);
  assert.match(f("Served thousands of students").join(), /thousands/i);
  assert.match(f("Improved scheduling accuracy").join(), /impact claim/);
});

test("impact wording is allowed only when the student supplied a result", () => {
  const withResult = imp.buildCorpus({ ...full, results: "Reduced clashes to zero on our department data" }, item);
  assert.deepEqual(imp.findUnsupportedClaims("Reduced clashes to zero in department timetables", withResult, { hasResults: true }), []);
});

const ok = JSON.stringify({ bullets: [
  { text: "Implemented a genetic-algorithm timetable scheduler in JavaScript with a room-clash constraint checker", supportedBy: ["contribution", "technologies"] },
  { text: "Reduced scheduling time by 85% across 40 classes", supportedBy: ["details"] },
  { text: "Modeled each timetable as a chromosome with a fitness function penalising room and faculty clashes", supportedBy: ["details"] },
  { text: "Built something with Docker", supportedBy: [] },
], questions: ["Did you test it on real department data?"] });

test("generation keeps supported bullets and drops invented claims with a clarification", async () => {
  const r = await imp.generateBullets({ item, facts: full, callAi: async () => ({ text: ok }) });
  assert.equal(r.bullets.length, 2);
  assert.ok(r.bullets.every((b) => b.supportedBy.length));
  assert.ok(r.clarifications.some((c) => /85/.test(c)));
  assert.ok(r.clarifications.some((c) => /docker/i.test(c)));
  assert.equal(r.questions.length, 1);
});

test("provider failure, timeout and malformed output become clean 502s", async () => {
  const run = (callAi, ms) => imp.generateBullets({ item, facts: full, callAi, timeoutMs: ms });
  await assert.rejects(run(async () => { throw new Error("503"); }), (e) => e.statusCode === 502 && /unavailable/.test(e.message));
  await assert.rejects(run(() => new Promise(() => {}), 20), (e) => e.statusCode === 502 && /too long/.test(e.message));
  await assert.rejects(run(async () => ({ text: "not json" })), (e) => e.statusCode === 502 && /unreadable/.test(e.message));
  await assert.rejects(run(async () => ({ text: JSON.stringify({ bullets: "nope" }) })), (e) => e.statusCode === 502);
});
