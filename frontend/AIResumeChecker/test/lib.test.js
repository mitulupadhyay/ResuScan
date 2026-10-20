import test from "node:test";
import assert from "node:assert/strict";
import { toForm, toPayload, validateForm } from "../src/lib/sectionsForm.js";
import { resolveOrder } from "../src/lib/sectionOrder.js";
import { isThinParse } from "../src/lib/resumeUtils.js";

const parsed = {
  basics: { name: "Asha Rao", title: "", email: "a@x.io", phone: "1", location: "", links: [{ label: "GitHub", url: "https://github.com/a" }] },
  summary: "Student.",
  skillGroups: [{ category: "Languages", items: ["C++", "JavaScript"] }],
  experience: [],
  education: [{ school: "GEHU", degree: "B.Tech", location: "", period: "2025", details: "CGPA 8.3" }],
  projects: [{ name: "ChronoGen", tech: ["JavaScript", "Node.js"], bullets: ["Built an API.", "Wrote a scheduler."], links: [] }],
  certifications: [], languages: [], interests: [], sectionOrder: [],
};

test("form round trip preserves content (lists and csv fields)", () => {
  const back = toPayload(toForm(parsed));
  assert.deepEqual(back.skillGroups, parsed.skillGroups);
  assert.deepEqual(back.projects[0].tech, ["JavaScript", "Node.js"]);
  assert.deepEqual(back.projects[0].bullets, ["Built an API.", "Wrote a scheduler."]);
  assert.equal(back.basics.links[0].url, "https://github.com/a");
});

test("csv and multi-line inputs are trimmed and empty entries dropped", () => {
  const f = toForm(parsed);
  f.projects[0].tech = " Go ,, Rust , ";
  f.projects[0].bullets = "\n First \n\n Second\n";
  const p = toPayload(f);
  assert.deepEqual(p.projects[0].tech, ["Go", "Rust"]);
  assert.deepEqual(p.projects[0].bullets, ["First", "Second"]);
});

test("flat legacy skills become one editable group", () => {
  const f = toForm({ basics: { name: "A" }, skills: ["Go", "SQL"] });
  assert.deepEqual(f.skillGroups, [{ category: "Technical Skills", items: "Go, SQL" }]);
});

test("validateForm: name and email", () => {
  const f = toForm(parsed);
  assert.equal(validateForm(f), "");
  f.basics.name = " ";
  assert.match(validateForm(f), /Name/);
  f.basics.name = "A"; f.basics.email = "nope";
  assert.match(validateForm(f), /Email/);
});

test("section order: automatic default differs for students and experienced; custom order wins; empty sections skipped", () => {
  assert.deepEqual(resolveOrder(parsed), ["summary", "education", "skills", "projects"]);
  const exp = { ...parsed, experience: [{ company: "X", role: "Y", bullets: [] }] };
  assert.deepEqual(resolveOrder(exp), ["summary", "skills", "experience", "projects", "education"]);
  assert.deepEqual(resolveOrder({ ...parsed, sectionOrder: ["projects", "skills"] }), ["projects", "skills", "summary", "education"]);
  assert.deepEqual(resolveOrder({ ...parsed, sectionOrder: ["experience", "projects"] }), ["projects", "summary", "education", "skills"]);
});

test("isThinParse", () => {
  assert.equal(isThinParse(null), true);
  assert.equal(isThinParse({ basics: { name: "A" } }), true);
  assert.equal(isThinParse({ skills: ["Go"] }), false);
});
