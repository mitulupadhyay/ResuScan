const { enrichParsed, resolveOrder } = require("./resumeText");

/**
 * Checks an exported PDF's extracted text against the structured resume it was made from.
 * Keep section titles/order in sync with frontend components/export/ResumeDocument.jsx.
 * It verifies *readability and preservation*, not ATS compatibility.
 */
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const digits = (s) => String(s || "").replace(/\D/g, "");
const shortUrl = (u) => String(u || "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");

/** Fraction (0..1) of `needle` found in `hay`, tolerant of line breaks and punctuation. */
function coverage(hay, needle) {
  const n = norm(needle);
  if (!n) return 1;
  if (hay.includes(n)) return 1;
  const size = 10;
  const chunks = [];
  for (let i = 0; i < n.length; i += size) chunks.push(n.slice(i, i + size));
  return chunks.filter((c) => hay.includes(c)).length / chunks.length;
}

function expectedHeadings(p) {
  const title = { summary: "Professional Summary", skills: "Technical Skills", experience: "Experience", projects: "Projects", education: "Education", certifications: "Certifications", additional: "Additional Information" };
  return resolveOrder(p).map((k) => title[k]);
}

/** Every piece of content the PDF is supposed to contain, with a label for reporting. */
function expectedItems(p) {
  const items = [];
  const add = (label, text, kind = "text") => { if (String(text || "").trim()) items.push({ label, text: String(text), kind }); };
  const b = p.basics || {};
  add("Name", b.name);
  add("Email", b.email);
  add("Phone", b.phone, "phone");
  (b.links || []).forEach((l) => add(`Link: ${l.label || l.url}`, l.url ? shortUrl(l.url) : l.label, "link"));
  add("Summary", p.summary);
  const skills = (p.skillGroups || []).length ? p.skillGroups.flatMap((g) => g.items || []) : p.skills || [];
  skills.forEach((s) => add(`Skill: ${s}`, s));
  (p.experience || []).forEach((e) => {
    add(`Experience role: ${e.role}`, e.role);
    add(`Experience company: ${e.company}`, e.company);
    add(`Experience dates: ${e.role}`, e.period);
    (e.bullets || []).forEach((x) => add(`Bullet (${e.company || e.role})`, x, "bullet"));
  });
  (p.projects || []).forEach((pr) => {
    add(`Project: ${pr.name}`, pr.name);
    (pr.tech || []).forEach((t) => add(`Tech (${pr.name}): ${t}`, t));
    const bullets = pr.bullets?.length ? pr.bullets : pr.description ? [pr.description] : [];
    bullets.forEach((x) => add(`Bullet (${pr.name})`, x, "bullet"));
    (pr.links || []).forEach((l) => add(`Link (${pr.name}): ${l.label || l.url}`, l.url ? shortUrl(l.url) : l.label, "link"));
  });
  (p.education || []).forEach((e) => {
    add(`School: ${e.school}`, e.school);
    add(`Degree: ${e.degree}`, e.degree);
    add(`Education dates: ${e.school}`, e.period);
  });
  (p.certifications || []).forEach((c) => add(`Certification: ${c.name}`, c.name));
  return items;
}

function validateExport(parsed, extractedText, { numPages = null } = {}) {
  const text = String(extractedText || "");
  const checks = [];
  const push = (label, status, detail) => checks.push({ label, status, detail });

  if (norm(text).length < 80) {
    push("Selectable text", "fail", "No readable text could be extracted from the PDF. It may be image-only.");
    return { ok: false, fidelity: 0, checks, missing: [], pages: numPages, differsMaterially: true };
  }
  push("Selectable text", "pass", `${text.length.toLocaleString()} characters extracted.`);

  const hay = norm(text);
  const items = expectedItems(parsed || {});
  const missing = [];
  let kept = 0;
  for (const it of items) {
    const ok = it.kind === "phone" ? digits(text).includes(digits(it.text)) : coverage(hay, it.text) >= 0.95;
    if (ok) kept += 1; else missing.push(it.label);
  }
  const fidelity = items.length ? Math.round((100 * kept) / items.length) : 0;
  push(
    "Content preserved",
    fidelity >= 98 ? "pass" : fidelity >= 90 ? "warn" : "fail",
    missing.length ? `${kept}/${items.length} items found. Missing: ${missing.slice(0, 6).join("; ")}${missing.length > 6 ? "…" : ""}` : `All ${items.length} items found in the PDF text.`
  );

  const headings = expectedHeadings(parsed || {});
  const pos = headings.map((h) => {
    const m = new RegExp(`^\\s*${h.replace(/\s+/g, "\\s+")}\\s*$`, "im").exec(text);
    return m ? m.index : -1;
  });
  const absent = headings.filter((_, i) => pos[i] < 0);
  const ordered = pos.filter((x) => x >= 0).every((x, i, a) => i === 0 || x > a[i - 1]);
  if (absent.length) push("Section headings", "fail", `Not found as their own line: ${absent.join(", ")}.`);
  else if (!ordered) push("Section order", "fail", "Sections appear in a different order than expected.");
  else push("Section headings", "pass", `${headings.length} standard headings found in order: ${headings.join(" > ")}.`);

  const bulletCount = items.filter((i) => i.kind === "bullet").length;
  const markers = (text.match(/•/g) || []).length;
  if (bulletCount) push("Bullet points", markers >= bulletCount * 0.8 ? "pass" : "warn", `${markers} bullet markers for ${bulletCount} bullets.`);

  const linkItems = items.filter((i) => i.kind === "link");
  if (linkItems.length) {
    const found = linkItems.filter((i) => coverage(hay, i.text) >= 0.95).length;
    push("Links readable", found === linkItems.length ? "pass" : "warn", `${found}/${linkItems.length} links appear as visible text.`);
  }

  // Round trip: can a parser recover the basics from the exported text alone?
  const back = enrichParsed(text, { basics: { links: [] } }).basics;
  const b = parsed?.basics || {};
  const okBasics = [
    !b.name || norm(back.name) === norm(b.name),
    !b.email || back.email?.toLowerCase() === b.email.toLowerCase(),
    !b.phone || digits(back.phone) === digits(b.phone),
  ];
  push("Contact info re-readable", okBasics.every(Boolean) ? "pass" : "warn", okBasics.every(Boolean) ? "Name, email and phone are recovered from the PDF text." : "A parser reading only the PDF text may not recover your name, email or phone correctly.");

  if (numPages) push("Length", numPages <= 2 ? "pass" : "warn", `${numPages} page${numPages === 1 ? "" : "s"}.${numPages > 2 ? " Most early-career resumes work best at 1-2 pages." : ""}`);

  return {
    ok: !checks.some((c) => c.status === "fail"),
    fidelity,
    checks,
    missing,
    pages: numPages,
    differsMaterially: fidelity < 95 || checks.some((c) => c.status === "fail"),
  };
}

module.exports = { validateExport, expectedHeadings, expectedItems };
