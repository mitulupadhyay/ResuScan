const { textHasSkill, RELATED } = require("./skillNormalizer");

const STOP = new Set(("a an the and or of to in for with on at by from as is are be been being this that these those you your we our us their it its " +
  "will can may must should have has had able ability strong good excellent knowledge understanding experience experienced working work " +
  "proficiency proficient familiarity familiar plus including etc such using use used").split(" "));

const stem = (w) => w.replace(/(ing|ed|es|s)$/i, "").toLowerCase();
const tokens = (s) =>
  [...new Set(
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9+#.\s/-]/g, " ")
      .split(/[\s/-]+/)
      .map((w) => w.replace(/^\.+|\.+$/g, ""))
      .filter((w) => w.length > 2 && !STOP.has(w))
      .map(stem)
  )];

const clip = (s, n = 240) => (String(s).length > n ? String(s).slice(0, n - 1).trimEnd() + "…" : String(s));

/**
 * Flatten a parsed resume into evidence units.
 * kind "applied" = used in a project/job (strong), "listed" = only named (weak).
 */
function buildEvidenceUnits(parsed, rawText) {
  const p = parsed || {};
  const u = [];
  const add = (section, text, kind) => {
    const t = String(text || "").trim();
    if (t) u.push({ section, text: t, kind });
  };

  add("Summary", p.summary, "listed");
  if (p.skillGroups?.length) p.skillGroups.forEach((g) => add("Skills", `${g.category}: ${(g.items || []).join(", ")}`, "listed"));
  else add("Skills", (p.skills || []).join(", "), "listed");
  (p.experience || []).forEach((e) => {
    const sec = `Experience - ${e.company || e.role || ""}`.trim();
    add(sec, [e.role, e.company].filter(Boolean).join(", "), "applied");
    (e.bullets || []).forEach((b) => add(sec, b, "applied"));
  });
  (p.projects || []).forEach((pr) => {
    const sec = `Projects - ${pr.name || ""}`.trim();
    if (pr.tech?.length) add(sec, `${pr.name}: ${pr.tech.join(", ")}`, "applied");
    const bullets = pr.bullets?.length ? pr.bullets : pr.description ? [pr.description] : [];
    bullets.forEach((b) => add(sec, b, "applied"));
  });
  (p.education || []).forEach((e) => add("Education", [e.degree, e.school, e.details].filter(Boolean).join(", "), "education"));
  (p.certifications || []).forEach((c) => add("Certifications", [c.name, c.issuer].filter(Boolean).join(", "), "listed"));

  // Parse was thin: fall back to raw text lines so evidence can still be quoted.
  if (u.filter((x) => x.section !== "Summary").length < 2 && rawText) {
    String(rawText).split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 3).forEach((l) => add("Resume text", l, "listed"));
  }
  return u;
}

const ACTIONS = {
  have_skill: "You said you have this. Add it to a project or experience bullet (what you built with it) so a recruiter can see it.",
  dont_have: "Confirmed gap. Learn it and build a small project with it before listing it on your resume.",
};

function finish(req, status, evidence, reason) {
  const c = req.clarification || null;
  let gapType = null;
  let nextAction = "";
  if (status === "matched") {
    nextAction = "No action needed. Keep this evidence near the top of your resume.";
  } else if (c === "dont_have") {
    gapType = "confirmed_gap";
    nextAction = ACTIONS.dont_have;
  } else if (c === "have_skill") {
    gapType = "missing_evidence";
    nextAction = ACTIONS.have_skill;
  } else if (status === "partial") {
    gapType = "missing_evidence";
    nextAction = "It is only named, not demonstrated. If you have used it, add what you built with it to a project or experience bullet.";
  } else if (status === "needs_review") {
    gapType = "unknown";
    nextAction = "Check the evidence shown. If it fits, make the wording explicit. Otherwise tell us whether you have this skill.";
  } else {
    gapType = "unknown";
    nextAction = "Not shown on your resume. Do you have this experience? Answer below so we can tell a missing mention from a real gap.";
  }
  return { requirementId: req.id, status, evidence: evidence.slice(0, 3).map((e) => ({ section: e.section, text: clip(e.text), kind: e.kind })), reason, nextAction, gapType };
}

function matchSkill(req, units) {
  const hits = units.filter((x) => textHasSkill(x.text, req.skill));
  const applied = hits.filter((x) => x.kind === "applied");
  const listed = hits.filter((x) => x.kind !== "applied");
  if (applied.length) return finish(req, "matched", [...applied, ...listed], `"${req.skill}" appears in your ${applied[0].section.split(" - ")[0].toLowerCase()} work.`);
  if (listed.length) return finish(req, "partial", listed, `"${req.skill}" is listed but not shown in a project or job.`);
  const rel = (RELATED[req.skill] || []).map((r) => ({ r, hit: units.find((x) => textHasSkill(x.text, r)) })).filter((x) => x.hit);
  // A related skill is context, not evidence: it earns no credit and is not shown as supporting text.
  if (rel.length) return finish(req, "not_evidenced", [], `"${req.skill}" is not mentioned. Related skill "${rel[0].r}" appears on your resume, but that is not evidence of "${req.skill}".`);
  return finish(req, "not_evidenced", [], `"${req.skill}" does not appear anywhere in your resume.`);
}

const DEGREE_RE = /\b(bachelor|b\.?\s?tech|btech|b\.?\s?e\b|b\.?\s?sc|bca|master|m\.?\s?tech|mca|m\.?\s?sc|degree)\b/i;
const FIELD_RE = /\b(computer|software|information technology|it\b|engineering|science|data|electronics|mathematics)\b/i;

function matchProse(req, units, hasExperience) {
  const text = req.text;
  if (req.category === "education" || (DEGREE_RE.test(text) && !/\d+\s*\+?\s*years?/i.test(text))) {
    const edu = units.filter((x) => x.kind === "education");
    if (!edu.length) return finish(req, "not_evidenced", [], "No education entry was found in the parsed resume.");
    const ok = edu.filter((x) => DEGREE_RE.test(x.text) && FIELD_RE.test(x.text));
    if (ok.length) return finish(req, "matched", ok, "Your education entry names a degree in a related field.");
    return finish(req, "needs_review", edu, "An education entry exists, but we can't confirm it meets this requirement.");
  }
  if (/\b\d+\s*\+?\s*(years?|yrs?)\b/i.test(text)) {
    return finish(req, "needs_review", units.filter((x) => x.section.startsWith("Experience")).slice(0, 2),
      hasExperience ? "Years of experience can't be verified automatically. Check your dates." : "Years of experience can't be verified from a resume without job history; projects may count for early-career roles.");
  }
  const rt = tokens(text);
  if (!rt.length) return finish(req, "needs_review", [], "This requirement is too short to match automatically.");
  let best = { score: 0, overlap: 0, unit: null };
  for (const x of units) {
    const ut = new Set(tokens(x.text));
    const overlap = rt.filter((t) => ut.has(t)).length;
    const score = overlap / rt.length;
    if (score > best.score || (score === best.score && x.kind === "applied" && best.unit?.kind !== "applied")) best = { score, overlap, unit: x };
  }
  const ev = best.unit ? [best.unit] : [];
  if (best.score >= 0.6 && best.overlap >= 2) return finish(req, "matched", ev, `Your resume covers ${Math.round(best.score * 100)}% of the key terms in this requirement.`);
  if (best.score >= 0.4 && best.overlap >= 2) return finish(req, "partial", ev, `Your resume covers about ${Math.round(best.score * 100)}% of the key terms in this requirement.`);
  if (best.score >= 0.2) return finish(req, "needs_review", ev, "Some related wording exists, but the match is ambiguous. Review the evidence.");
  return finish(req, "not_evidenced", [], "No wording on your resume corresponds to this requirement.");
}

/** Deterministic: same resume + same requirements => same results. */
function matchRequirements(requirements, parsed, rawText) {
  const units = buildEvidenceUnits(parsed, rawText);
  const hasExperience = (parsed?.experience || []).length > 0;
  return requirements.map((r) => (r.category === "skill" && r.skill ? matchSkill(r, units) : matchProse(r, units, hasExperience)));
}

module.exports = { matchRequirements, buildEvidenceUnits, tokens };
