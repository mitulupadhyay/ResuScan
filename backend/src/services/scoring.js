/**
 * ResuScan readiness estimate - scoring version 1.0.0
 *
 *  overall = round(0.60 * requirementCoverage + 0.25 * evidenceStrength + 0.15 * documentQuality)
 *
 *  requirementCoverage = 100 * sum(weight * credit) / sum(weight)
 *    credit : matched 1.0 | partial 0.5 | needs_review 0.25 | not_evidenced 0
 *    weight : required 3 | preferred 1 | responsibility 1
 *  evidenceStrength = 100 * (weight of matched requirements shown in a project/job)
 *                         / (weight of matched + partial requirements)
 *  documentQuality  = 100 * (checklist items passed / total) - see checks() below
 *
 * The weights are design choices, NOT scientifically validated.
 */
const SCORING_VERSION = "1.0.0";
const CREDIT = { matched: 1, partial: 0.5, needs_review: 0.25, not_evidenced: 0 };
const WEIGHT = { required: 3, preferred: 1, responsibility: 1 };
const W = { coverage: 0.6, evidence: 0.25, quality: 0.15 };

const LIMITATIONS = [
  "This is a ResuScan estimate based on your resume text and the job description you pasted. It is not a score from any employer's applicant tracking system.",
  "Different employers and ATS products use different rules, and a human usually makes the final decision.",
  "Weights and thresholds are design choices that have not been validated against hiring outcomes.",
  "A requirement marked 'Not evidenced' means it isn't shown on the resume. It does not prove you lack the skill.",
];

function checks(parsed) {
  const p = parsed || {};
  const b = p.basics || {};
  const bullets =
    (p.experience || []).reduce((n, e) => n + (e.bullets?.length || 0), 0) +
    (p.projects || []).reduce((n, x) => n + (x.bullets?.length || (x.description ? 1 : 0)), 0);
  return [
    ["Name found", !!b.name?.trim()],
    ["Email found", !!b.email?.trim()],
    ["Phone found", !!b.phone?.trim()],
    ["Education section found", (p.education || []).length > 0],
    ["Skills section found", (p.skills || []).length > 0 || (p.skillGroups || []).length > 0],
    ["Projects or experience found", (p.projects || []).length + (p.experience || []).length > 0],
    ["At least 3 descriptive bullets", bullets >= 3],
    ["Profile links include real URLs", (b.links || []).some((l) => l.url)],
  ].map(([label, pass]) => ({ label, pass }));
}

function scoreMatch(requirements, results, parsed) {
  const byId = new Map(results.map((r) => [r.requirementId, r]));
  let wSum = 0, credit = 0, wGood = 0, wApplied = 0;
  const counts = { matched: 0, partial: 0, needs_review: 0, not_evidenced: 0 };

  for (const req of requirements) {
    const res = byId.get(req.id);
    if (!res) continue;
    const w = WEIGHT[req.type] ?? 1;
    wSum += w;
    credit += w * CREDIT[res.status];
    counts[res.status] += 1;
    if (res.status === "matched" || res.status === "partial") {
      wGood += w;
      if (res.status === "matched" && res.evidence.some((e) => e.kind === "applied")) wApplied += w;
      else if (res.status === "matched" && req.category !== "skill") wApplied += w; // prose matches count as shown
    }
  }

  const coverage = wSum ? (100 * credit) / wSum : 0;
  const evidence = wGood ? (100 * wApplied) / wGood : 0;
  const qc = checks(parsed);
  const quality = (100 * qc.filter((c) => c.pass).length) / qc.length;
  const overall = wSum ? Math.round(W.coverage * coverage + W.evidence * evidence + W.quality * quality) : null;

  const severity = { not_evidenced: 3, needs_review: 2, partial: 1 };
  const priorities = requirements
    .map((req) => ({ req, res: byId.get(req.id) }))
    .filter((x) => x.res && x.res.status !== "matched")
    .sort((a, b) => (WEIGHT[b.req.type] ?? 1) * severity[b.res.status] - (WEIGHT[a.req.type] ?? 1) * severity[a.res.status])
    .slice(0, 5)
    .map(({ req, res }) => ({ requirementId: req.id, text: req.text, type: req.type, status: res.status, action: res.nextAction }));

  return {
    version: SCORING_VERSION,
    overall,
    requirementCoverage: Math.round(coverage),
    evidenceStrength: Math.round(evidence),
    documentQuality: Math.round(quality),
    weights: W,
    counts,
    qualityChecks: qc,
    priorities,
    limitations: LIMITATIONS,
  };
}

module.exports = { scoreMatch, SCORING_VERSION, LIMITATIONS };
