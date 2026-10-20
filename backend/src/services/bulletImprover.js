const { Type } = require("@google/genai");
const { z } = require("zod");
const ApiError = require("../utils/ApiError");
const { findSkills, textHasSkill } = require("./skillNormalizer");

const FACT_KEYS = ["problem", "contribution", "technologies", "details", "challenges", "results"];
const words = (s) => String(s || "").trim().split(/\s+/).filter(Boolean).length;
const VAGUE = /\b(worked on|helped (with|in)|involved in|participated|various|etc\.?|responsible for|assisted)\b/i;

/** Plain item snapshot from a parsed resume (project or experience entry). */
function getItem(parsed, type, index) {
  const list = type === "project" ? parsed?.projects : parsed?.experience;
  const it = list?.[index];
  if (!it) return null;
  if (type === "project") {
    const bullets = it.bullets?.length ? it.bullets : it.description ? [it.description] : [];
    return { type, index, name: it.name || "", tech: it.tech || [], bullets };
  }
  return { type, index, name: [it.role, it.company].filter(Boolean).join(", "), tech: [], bullets: it.bullets || [] };
}

/** Everything the student has actually told us: the facts they typed plus the item's own existing text. */
function buildCorpus(facts, item) {
  return [
    ...FACT_KEYS.map((k) => facts?.[k] || ""),
    item?.name || "",
    ...(item?.tech || []),
    ...(item?.bullets || []),
  ].join("\n");
}

/** Prefill the facts form from what is already on the resume; user input overrides. */
function mergeFacts(item, given = {}) {
  const base = { problem: "", contribution: "", technologies: (item?.tech || []).join(", "), details: "", challenges: "", results: "" };
  for (const k of FACT_KEYS) if (String(given[k] || "").trim()) base[k] = String(given[k]).trim();
  return base;
}

/** Deterministic: which facts are missing or too vague to write a truthful bullet from? */
function assessFacts(facts) {
  const q = [];
  const add = (key, question, blocking) => q.push({ key, question, blocking });
  const c = facts.contribution || "";
  if (words(c) < 8) add("contribution", "What did YOU personally build or do? Name the specific features, modules or tasks you handled.", true);
  else if (VAGUE.test(c) && words(c) < 15) add("contribution", "\"Worked on / helped with\" is vague. What exactly did you implement, and how?", true);
  if (!facts.technologies.trim()) add("technologies", "Which languages, frameworks or tools did you actually use?", true);
  if (words(facts.details) < 5 && words(c) < 15) add("details", "How does it work technically? Describe one implementation detail or design decision.", true);
  if (!facts.problem.trim()) add("problem", "What problem does it solve, and for whom?", false);
  if (!facts.results.trim()) add("results", "Any outcome you can actually verify (users, speed, accuracy, awards)? Skip this if there isn't one - we won't invent one.", false);
  return { ready: !q.some((x) => x.blocking), questions: q };
}

const NUM_RE = /(?<![\w.])\d[\d,]*(?:\.\d+)?/g;
const IMPACT_RE = /\b(reduc|improv|increas|boost|optimi[sz]|accelerat|streamlin|enhanc|scal)\w*/gi;
const LEAD_RE = /\b(led|lead|leading|managed|spearheaded|mentored|architected|owned|directed)\b/gi;
const SCALE_RE = /\b(thousands|millions|hundreds)\b/gi;

/**
 * Claims in `text` that the student never supplied. Returns human-readable strings; empty = fully supported.
 * This does NOT verify truth - it only stops us (or the AI) from inventing details.
 */
function findUnsupportedClaims(text, corpus, { hasResults = false } = {}) {
  const lower = String(corpus).toLowerCase();
  const bad = [];
  for (const n of String(text).match(NUM_RE) || []) if (!lower.includes(n.toLowerCase())) bad.push(`the number "${n}"`);
  for (const s of findSkills(text)) if (!textHasSkill(corpus, s)) bad.push(`the technology "${s}"`);
  for (const m of String(text).match(LEAD_RE) || []) if (!new RegExp(`\\b${m}\\b`, "i").test(corpus)) bad.push(`the leadership claim "${m}"`);
  for (const m of String(text).match(SCALE_RE) || []) if (!lower.includes(m.toLowerCase())) bad.push(`the scale claim "${m}"`);
  if (!hasResults) {
    for (const m of String(text).match(IMPACT_RE) || []) {
      const stem = m.slice(0, 5).toLowerCase();
      if (!lower.includes(stem)) bad.push(`the impact claim "${m}" (no result was provided)`);
    }
  }
  return [...new Set(bad)];
}

const schema = {
  type: Type.OBJECT,
  required: ["bullets", "questions"],
  properties: {
    bullets: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["text", "supportedBy"],
        properties: {
          text: { type: Type.STRING },
          supportedBy: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Which supplied fact keys support this bullet: problem, contribution, technologies, details, challenges, results, original" },
        },
      },
    },
    questions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Extra clarifying questions if something important is unclear" },
  },
};
const validator = z.object({
  bullets: z.array(z.object({ text: z.string(), supportedBy: z.array(z.string()).default([]) })).default([]),
  questions: z.array(z.string()).default([]),
});

function buildPrompt(item, facts, targetRole) {
  return [
    "You help a college student write truthful, specific resume bullets.",
    targetRole ? `Target role: ${targetRole}.` : "",
    "RULES (never break):",
    "- Use ONLY the facts below. Do not invent numbers, users, performance gains, technologies, responsibilities or achievements.",
    "- Only mention a result or impact if the 'results' fact states it. No 'improved'/'reduced'/'scaled' otherwise.",
    "- Write 2-3 alternative bullets with different emphasis. Each: one sentence, starts with a past-tense action verb, names real technologies from the facts, describes the student's own contribution.",
    "- For each bullet list supportedBy: the fact keys it relies on (problem, contribution, technologies, details, challenges, results, original).",
    "- If something important is unclear, add a short question to 'questions' instead of guessing.",
    "",
    `ITEM: ${item.name}`,
    `EXISTING BULLETS ('original'): ${JSON.stringify(item.bullets)}`,
    `FACTS: ${JSON.stringify(facts)}`,
  ].filter(Boolean).join("\n");
}

function withTimeout(p, ms) {
  let t;
  const timeout = new Promise((_, rej) => { t = setTimeout(() => rej(Object.assign(new Error("timed out"), { code: "TIMEOUT" })), ms); });
  return Promise.race([p, timeout]).finally(() => clearTimeout(t));
}

/** @returns {{bullets: {text, supportedBy}[], clarifications: string[], questions: string[]}} */
async function generateBullets({ item, facts, targetRole, callAi, timeoutMs = 25000 }) {
  let raw;
  try {
    const res = await withTimeout(callAi(buildPrompt(item, facts, targetRole), schema, 0.4), timeoutMs);
    raw = res.text;
  } catch (err) {
    const msg = err.code === "TIMEOUT" ? "The AI took too long to respond. Please try again." : "The AI service is unavailable right now. Please try again in a moment.";
    throw new ApiError(502, msg);
  }
  let parsed;
  try {
    parsed = validator.parse(JSON.parse(raw));
  } catch {
    throw new ApiError(502, "The AI returned an unreadable response. Please try again.");
  }

  const corpus = buildCorpus(facts, item);
  const hasResults = !!facts.results.trim();
  const valid = new Set([...FACT_KEYS, "original"]);
  const bullets = [];
  const clarifications = [];
  const seen = new Set();
  for (const b of parsed.bullets) {
    const text = b.text.replace(/^[\s\-\u2022*]+/, "").replace(/\s+/g, " ").trim();
    if (!text || text.length > 320 || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    const bad = findUnsupportedClaims(text, corpus, { hasResults });
    if (bad.length) {
      clarifications.push(`A suggestion mentioned ${bad.join(", ")}, which you didn't provide, so it was removed. If it's true, add it to your details and generate again.`);
      continue;
    }
    const supportedBy = [...new Set(b.supportedBy.map((k) => k.toLowerCase()).filter((k) => valid.has(k)))];
    if (!supportedBy.length) {
      clarifications.push("A suggestion didn't say which of your facts supports it, so it was removed.");
      continue;
    }
    bullets.push({ text, supportedBy });
    if (bullets.length >= 3) break;
  }
  return { bullets, clarifications, questions: parsed.questions.map((q) => String(q).trim()).filter(Boolean).slice(0, 3) };
}

module.exports = { getItem, buildCorpus, mergeFacts, assessFacts, findUnsupportedClaims, generateBullets, FACT_KEYS };
