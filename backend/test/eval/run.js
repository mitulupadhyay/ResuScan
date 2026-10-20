// Runs the labeled cases and returns per-label outcomes. Used by eval.test.js and for manual inspection.
const { heuristicParse } = require("../../src/services/jobParser");
const { matchRequirements } = require("../../src/services/matcher");
const { scoreMatch } = require("../../src/services/scoring");
const { resumes, jds, labels } = require("./cases");

function run() {
  const parsedJd = Object.fromEntries(Object.entries(jds).map(([k, t]) => [k, heuristicParse(t).map((r, i) => ({ ...r, id: `r${i + 1}`, clarification: null }))]));
  const outcomes = [];
  for (const [resume, jd, needle, expected, note] of labels) {
    const reqs = parsedJd[jd];
    const n = String(needle).toLowerCase();
    const req = reqs.find((r) => r.skill === n) || reqs.find((r) => r.text.toLowerCase().includes(n)) || reqs.find((r) => r.sourceSentence.toLowerCase().includes(n));
    if (!req) { outcomes.push({ resume, jd, needle, expected, actual: null, found: false, ok: false }); continue; }
    const res = matchRequirements([req], resumes[resume], "")[0];
    const ok = [].concat(expected).includes(res.status);
    outcomes.push({ resume, jd, needle, expected, actual: res.status, found: true, ok, known: note === "known-limitation" });
  }
  const scores = {};
  for (const r of Object.keys(resumes)) for (const j of Object.keys(jds)) {
    const reqs = parsedJd[j];
    scores[`${r}|${j}`] = scoreMatch(reqs, matchRequirements(reqs, resumes[r], ""), resumes[r]);
  }
  return { outcomes, scores, parsedJd };
}
module.exports = { run };
