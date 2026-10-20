require("./fixtures");
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { extractPlain } = require("../src/services/pdfService");
const { validateExport } = require("../src/services/exportValidator");

const fx = (f) => path.join(__dirname, "fixtures", f);
const load = async (name) => {
  const { text, numPages } = await extractPlain(fs.readFileSync(fx(`${name}.pdf`)));
  return { text, numPages, parsed: JSON.parse(fs.readFileSync(fx(`${name}.json`), "utf8")) };
};
const status = (r, label) => r.checks.find((c) => c.label === label)?.status;

test("student export: text selectable, content preserved, headings in order (Education first)", async () => {
  const { text, numPages, parsed } = await load("student");
  const r = validateExport(parsed, text, { numPages });
  assert.equal(r.ok, true);
  assert.equal(r.fidelity, 100);
  assert.equal(r.differsMaterially, false);
  assert.equal(status(r, "Section headings"), "pass");
  assert.match(r.checks.find((c) => c.label === "Section headings").detail, /Professional Summary > Education > Technical Skills > Projects/);
  assert.equal(status(r, "Links readable"), "pass");
  assert.equal(status(r, "Bullet points"), "pass");
  assert.equal(status(r, "Contact info re-readable"), "pass");
});

test("multi-page experienced export: Experience leads, arrows/dates/bullets survive", async () => {
  const { text, numPages, parsed } = await load("senior");
  const r = validateExport(parsed, text, { numPages });
  assert.equal(r.ok, true, JSON.stringify(r.checks));
  assert.equal(numPages, 2);
  assert.match(r.checks.find((c) => c.label === "Section headings").detail, /Technical Skills > Experience > Education/);
});

test("content missing from the PDF is reported and flagged as materially different", async () => {
  const { text, numPages, parsed } = await load("student");
  parsed.projects.push({ name: "Brand New Chatbot", tech: ["Rust"], bullets: ["Built an offline chatbot for campus queries"], links: [] });
  const r = validateExport(parsed, text, { numPages });
  assert.ok(r.missing.some((m) => /Brand New Chatbot/.test(m)));
  assert.equal(r.differsMaterially, true);
  assert.notEqual(status(r, "Content preserved"), "pass");
});

test("a section expected by the editor but absent in the PDF fails the heading check", async () => {
  const { text, numPages, parsed } = await load("student");
  parsed.experience = [{ company: "Acme", role: "Intern", period: "2025", bullets: ["Did things"] }];
  const r = validateExport(parsed, text, { numPages });
  assert.equal(status(r, "Section headings"), "fail");
  assert.equal(r.ok, false);
});

test("image-only PDF: reported as having no selectable text", async () => {
  const { text } = await extractPlain(fs.readFileSync(fx("image-only.pdf")));
  const r = validateExport({ basics: { name: "A" } }, text);
  assert.equal(r.ok, false);
  assert.equal(status(r, "Selectable text"), "fail");
});

test("changed text is detected (round trip is not just 'something is there')", async () => {
  const { text, numPages, parsed } = await load("student");
  parsed.basics.email = "someone.else@example.org";
  const r = validateExport(parsed, text, { numPages });
  assert.ok(r.missing.includes("Email"));
});

test("custom section order: PDF follows it, validator expects it, and a different expected order fails", async () => {
  const { text, numPages, parsed } = await load("custom");
  const r = validateExport(parsed, text, { numPages });
  assert.equal(r.ok, true, JSON.stringify(r.checks));
  assert.match(r.checks.find((c) => c.label === "Section headings").detail, /Technical Skills > Projects > Education > Professional Summary/);
  const auto = { ...parsed, sectionOrder: [] };
  const r2 = validateExport(auto, text, { numPages });
  assert.equal(r2.ok, false);
  assert.equal(status(r2, "Section order"), "fail");
});

test("resumeToText and the schema respect a saved section order", () => {
  const { resumeToText } = require("../src/services/resumeText");
  const { normalizeSections } = require("../src/services/sectionsSchema");
  const p = normalizeSections({ ...JSON.parse(fs.readFileSync(fx("student.json"), "utf8")), sectionOrder: ["projects", "projects", "skills"] });
  assert.deepEqual(p.sectionOrder, ["projects", "skills"]); // de-duplicated
  const t = resumeToText(p);
  assert.ok(t.indexOf("PROJECTS") < t.indexOf("SKILLS"));
  assert.ok(t.indexOf("SKILLS") < t.indexOf("SUMMARY"));
  assert.throws(() => normalizeSections({ basics: { name: "A" }, sectionOrder: ["hacking"] }));
});
