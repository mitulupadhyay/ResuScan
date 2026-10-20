// Pure helpers shared by the parser, the optimizer and the routes.
// Nothing here talks to the database or to Gemini.

const MD_LINK_RE = /\[([^\]\n]{1,80})\]\((https?:\/\/[^)\s]+)\)/g;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const SECTION_RE =
  /^\s*(professional\s+summary|summary|objective|experience|work\s+experience|education|projects?|skills|technical\s+skills|certifications?)\b/im;

function clone(x) {
  return JSON.parse(JSON.stringify(x || {}));
}

/** True when the parsed resume has no real body content (summary/experience/education/projects/skills). */
function isThinParse(s) {
  if (!s) return true;
  return !(
    (s.summary && s.summary.trim()) ||
    s.experience?.length ||
    s.education?.length ||
    s.projects?.length ||
    s.skills?.length
  );
}

/** [{ label, url, index }] for every markdown-style link found in the extracted PDF text. */
function extractLinks(text) {
  const out = [];
  for (const m of String(text || "").matchAll(MD_LINK_RE)) {
    out.push({ label: m[1].trim(), url: m[2].trim(), index: m.index });
  }
  return out;
}

function headerEnd(text) {
  const t = String(text || "");
  const m = SECTION_RE.exec(t.slice(40)); // skip the name line itself
  const end = m ? m.index + 40 : 700;
  return Math.min(Math.max(end, 120), 900);
}

/**
 * Deterministically fill what Gemini often misses: name, email, phone and the
 * real URLs behind link labels ("LinkedIn", "GitHub", "Live Demo").
 */
function enrichParsed(rawText, parsed) {
  const p = clone(parsed);
  p.basics = p.basics || {};
  const b = p.basics;
  b.links = Array.isArray(b.links) ? b.links : [];
  const text = String(rawText || "");
  const hEnd = headerEnd(text);
  const header = text.slice(0, hEnd);

  if (!b.email?.trim()) {
    const m = EMAIL_RE.exec(text);
    if (m) b.email = m[0];
  }
  if (!b.phone?.trim()) {
    const m = /(\+?\d[\d\s().-]{8,}\d)/.exec(header);
    if (m && m[1].replace(/\D/g, "").length >= 10) b.phone = m[1].trim();
  }
  if (!b.name?.trim()) {
    const first = header
      .split("\n")
      .map((l) => l.trim())
      .find(Boolean);
    if (
      first &&
      first.length <= 60 &&
      !/[@\d\[\]/]/.test(first) &&
      first.split(/\s+/).length <= 5
    ) {
      b.name = first;
    }
  }

  const links = extractLinks(text);
  const headerLinks = links.filter((l) => l.index < hEnd);
  const bodyLinks = links.filter((l) => l.index >= hEnd);

  if (!b.links.length && headerLinks.length) {
    b.links = headerLinks.map(({ label, url }) => ({ label, url }));
  } else {
    for (const l of b.links) {
      if (!l.url) {
        const hit = links.find(
          (x) => x.label.toLowerCase() === String(l.label || "").toLowerCase()
        );
        if (hit) l.url = hit.url;
      }
    }
  }

  // Project links: consume body links in reading order, matching by label.
  const pool = [...bodyLinks];
  for (const proj of p.projects || []) {
    for (const l of proj.links || []) {
      if (l.url) continue;
      const i = pool.findIndex(
        (x) => x.label.toLowerCase() === String(l.label || "").toLowerCase()
      );
      if (i >= 0) l.url = pool.splice(i, 1)[0].url;
    }
  }
  return p;
}

function linkText(l) {
  if (!l) return "";
  return l.url
    ? `${l.label ? l.label + ": " : ""}${l.url}`
    : l.label || "";
}

const SECTION_KEYS = ["summary", "skills", "experience", "projects", "education", "certifications", "additional"];

function sectionContent(p) {
  return {
    summary: !!p.summary?.trim(),
    skills: (p.skillGroups || []).length > 0 || (p.skills || []).length > 0,
    experience: (p.experience || []).length > 0,
    projects: (p.projects || []).length > 0,
    education: (p.education || []).length > 0,
    certifications: (p.certifications || []).some((c) => c.name),
    additional: (p.languages || []).length > 0 || (p.interests || []).length > 0,
  };
}

/** Sections to render, in order. A saved sectionOrder wins; sections it omits are appended in default order. Keep in sync with frontend lib/sectionOrder.js. */
function resolveOrder(p) {
  const has = sectionContent(p || {});
  const fallback = has.experience
    ? ["summary", "skills", "experience", "projects", "education", "certifications", "additional"]
    : ["summary", "education", "skills", "projects", "certifications", "additional"];
  const chosen = (p?.sectionOrder || []).filter((k) => SECTION_KEYS.includes(k));
  const order = [...new Set([...chosen, ...fallback])];
  return order.filter((k) => has[k]);
}

/** Plain-text rendering of a structured resume (stored as rawText for rewritten versions). */
function resumeToText(p) {
  const s = p || {};
  const b = s.basics || {};
  const head = [];
  if (b.name) head.push(b.name);
  if (b.title) head.push(b.title);
  const contact = [b.email, b.phone, b.location, ...(b.links || []).map(linkText)].filter(Boolean);
  if (contact.length) head.push(contact.join(" | "));

  const blocks = {
    summary: () => ["SUMMARY", s.summary],
    skills: () => [
      "SKILLS",
      ...(s.skillGroups?.length
        ? s.skillGroups.map((g) => `${g.category}: ${(g.items || []).join(", ")}`)
        : [`Skills: ${(s.skills || []).join(", ")}`]),
    ],
    experience: () => [
      "EXPERIENCE",
      ...s.experience.flatMap((e) => [
        [e.role, e.company, e.location].filter(Boolean).join(" | ") + (e.period ? ` (${e.period})` : ""),
        ...(e.bullets || []).map((x) => `- ${x}`),
      ]),
    ],
    projects: () => [
      "PROJECTS",
      ...s.projects.flatMap((pr) => [
        [pr.name, pr.tech?.length ? pr.tech.join(", ") : ""].filter(Boolean).join(" | "),
        ...(pr.bullets?.length ? pr.bullets : pr.description ? [pr.description] : []).map((x) => `- ${x}`),
        ...(pr.links || []).map(linkText).filter(Boolean),
      ]),
    ],
    education: () => [
      "EDUCATION",
      ...s.education.flatMap((e) => [
        [e.school, e.degree].filter(Boolean).join(" | ") + (e.period ? ` (${e.period})` : ""),
        ...(e.details ? [e.details] : []),
      ]),
    ],
    certifications: () => ["CERTIFICATIONS", ...s.certifications.map((c) => [c.name, c.issuer, c.year].filter(Boolean).join(" | "))],
    additional: () => [
      "ADDITIONAL INFORMATION",
      ...(s.languages?.length ? [`Languages: ${s.languages.join(", ")}`] : []),
      ...(s.interests?.length ? [`Interests: ${s.interests.join(", ")}`] : []),
    ],
  };

  const out = [...head];
  for (const key of resolveOrder(s)) out.push("", ...blocks[key]());
  return out.join("\n").trim();
}

module.exports = { isThinParse, extractLinks, enrichParsed, resumeToText, resolveOrder, SECTION_KEYS };
