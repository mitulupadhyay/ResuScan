const { Type } = require("@google/genai");
const { z } = require("zod");
const { findSkills, canonicalize } = require("./skillNormalizer");

const MAX_REQS = 60;
const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

const HEADINGS = [
  ["preferred", /^(preferred|nice[- ]to[- ]have|good to have|bonus|pluses|plus points|desired|additional (skills|qualifications))\b/i],
  ["responsibility", /^(responsibilities|what you.?ll do|what you will do|key duties|duties|the role|your role|day[- ]to[- ]day|you will)\b/i],
  ["required", /^(requirements?|qualifications?|must[- ]have|what you.?ll need|what we.?re looking for|required|minimum|skills|who you are|you have|about you|eligibility)\b/i],
];
const PREFERRED_CUE = /\b(preferred|nice to have|a plus|is a plus|bonus|good to have|desirable|advantage|ideally)\b/i;
const REQUIRED_CUE = /\b(must|required|mandatory|need to|minimum)\b/i;

function headingOf(line) {
  const l = line.replace(/[:*#_-]+$/g, "").replace(/^[#*\s]+/, "").trim();
  if (l.length > 60) return null;
  for (const [type, re] of HEADINGS) if (re.test(l)) return type;
  return null;
}

function categoryOf(text, fallback) {
  if (/\b(bachelor|master|b\.?tech|m\.?tech|b\.?e\b|b\.?sc|degree|diploma|graduat|pursuing)\b/i.test(text)) return "education";
  if (/\b\d+\s*\+?\s*(years?|yrs?)\b/i.test(text)) return "experience";
  return fallback;
}

/** Deterministic parser: section headings + bullet lines + known-skill detection. */
function heuristicParse(text) {
  const lines = String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const reqs = [];
  let section = "required";
  let sawHeading = false;

  for (const raw of lines) {
    const h = headingOf(raw);
    if (h) {
      section = h;
      sawHeading = true;
      continue;
    }
    const item = raw.replace(/^(?:[\u2022\u25CF\u25AA*\-\u2013\u2014>]+|\d{1,2}[.)])\s*/, "").trim();
    const isBullet = item !== raw;
    if (item.length < 2) continue;
    // Without headings, only bullet-like lines count; with headings, every line under one does.
    if (!isBullet && !sawHeading && item.split(" ").length > 25) continue;
    if (!isBullet && item.split(" ").length > 40) continue;

    let type = section === "preferred" ? "preferred" : section === "responsibility" ? "responsibility" : "required";
    if (PREFERRED_CUE.test(item)) type = "preferred";
    else if (REQUIRED_CUE.test(item) && type === "preferred") type = "required";

    const skills = findSkills(item);
    if (!skills.length && item.length < 4) continue; // too short to be a meaningful non-skill requirement
    if (skills.length) {
      for (const s of skills) {
        reqs.push({ text: s, type: type === "responsibility" ? "required" : type, category: "skill", skill: s, sourceSentence: item, needsReview: false });
      }
    } else if (isBullet || sawHeading) {
      reqs.push({ text: item, type, category: categoryOf(item, type === "responsibility" ? "responsibility" : "qualification"), skill: "", sourceSentence: item, needsReview: false });
    }
  }
  return dedupe(reqs);
}

function dedupe(reqs) {
  const out = new Map();
  for (const r of reqs) {
    const key = r.category === "skill" ? `skill:${r.skill}` : `t:${norm(r.text)}`;
    const prev = out.get(key);
    if (!prev) out.set(key, r);
    else if (prev.type !== "required" && r.type === "required") out.set(key, r); // required wins
  }
  return [...out.values()].slice(0, MAX_REQS);
}

const aiSchema = {
  type: Type.OBJECT,
  required: ["jobTitle", "seniority", "requirements"],
  properties: {
    jobTitle: { type: Type.STRING },
    seniority: { type: Type.STRING, description: "intern, junior, mid, senior, lead or unspecified" },
    requirements: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["text", "type", "category", "skill", "sourceSentence"],
        properties: {
          text: { type: Type.STRING, description: "Short requirement. For skills, just the skill name." },
          type: { type: Type.STRING, description: "required, preferred or responsibility" },
          category: { type: Type.STRING, description: "skill, qualification, education, experience or responsibility" },
          skill: { type: Type.STRING, description: "Skill/tool/technology name if category is skill, else empty" },
          sourceSentence: { type: Type.STRING, description: "VERBATIM sentence or bullet from the job description" },
        },
      },
    },
  },
};

const aiValidator = z.object({
  jobTitle: z.string().default(""),
  seniority: z.string().default(""),
  requirements: z
    .array(
      z.object({
        text: z.string(),
        type: z.string().default("required"),
        category: z.string().default("qualification"),
        skill: z.string().default(""),
        sourceSentence: z.string().default(""),
      })
    )
    .default([]),
});

/** Keep only what is grounded in the JD; flag anything we cannot trace back to its text. */
function sanitizeAi(parsed, jdText) {
  const jd = norm(jdText);
  const types = new Set(["required", "preferred", "responsibility"]);
  const cats = new Set(["skill", "qualification", "education", "experience", "responsibility"]);
  const reqs = parsed.requirements.map((r) => {
    const type = types.has(r.type) ? r.type : "required";
    let category = cats.has(r.category) ? r.category : "qualification";
    const src = norm(r.sourceSentence);
    const grounded = src.length > 3 && jd.includes(src);
    const skill = category === "skill" ? canonicalize(r.skill || r.text) : "";
    if (category === "skill" && !skill) category = "qualification";
    return {
      text: String(r.text).trim().slice(0, 300),
      type,
      category,
      skill,
      sourceSentence: grounded ? r.sourceSentence.trim().slice(0, 500) : "",
      needsReview: !grounded,
    };
  }).filter((r) => r.text);
  return dedupe(reqs);
}

const SENIORITY = [["intern", /\bintern(ship)?\b/i], ["senior", /\b(senior|sr\.?|lead|principal|staff)\b/i], ["junior", /\b(junior|jr\.?|entry[- ]level|graduate|fresher)\b/i]];
const guessSeniority = (t) => (SENIORITY.find(([, re]) => re.test(t)) || ["unspecified"])[0];
const guessTitle = (jd) => {
  const first = String(jd).split(/\r?\n/).map((l) => l.trim()).find(Boolean) || "";
  return first.length <= 80 && !/[.;]$/.test(first) ? first : "";
};

/**
 * @param {Function} [callAi] - async (prompt, schema, temp) => ({ text }); omitted when Gemini isn't configured
 * @returns {{jobTitle, seniority, requirements, parsedBy: "ai"|"heuristic", warning?: string}}
 */
async function parseJobDescription(jdText, { title, callAi } = {}) {
  const base = {
    jobTitle: (title || "").trim() || guessTitle(jdText),
    seniority: guessSeniority(`${title || ""} ${String(jdText).slice(0, 400)}`),
  };

  let warning = "";
  if (callAi) {
    try {
      const prompt = [
        "Extract the hiring requirements from this job description. Use ONLY what the text says.",
        "- type: 'required' (must-have), 'preferred' (nice-to-have / bonus) or 'responsibility' (what the person will do).",
        "- One entry per distinct skill/tool; skill entries use the skill name as text.",
        "- sourceSentence must be copied VERBATIM from the job description. Never invent requirements.",
        "- Do not infer requirements that are not written.",
        "",
        "JOB DESCRIPTION:",
        "----",
        jdText,
        "----",
      ].join("\n");
      const { text } = await callAi(prompt, aiSchema, 0.1);
      const parsed = aiValidator.parse(JSON.parse(text));
      const requirements = sanitizeAi(parsed, jdText);
      if (requirements.length) {
        return {
          jobTitle: base.jobTitle || parsed.jobTitle.trim().slice(0, 120),
          seniority: /^(intern|junior|mid|senior|lead)$/.test(parsed.seniority) ? parsed.seniority : base.seniority,
          requirements,
          parsedBy: "ai",
        };
      }
      warning = "AI extraction found no requirements; used the built-in parser instead.";
    } catch (err) {
      warning = "AI extraction was unavailable; used the built-in parser instead.";
    }
  }
  return { ...base, requirements: heuristicParse(jdText), parsedBy: "heuristic", warning };
}

module.exports = { parseJobDescription, heuristicParse, sanitizeAi };
