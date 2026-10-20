const { GoogleGenAI, Type } = require("@google/genai");
const { z } = require("zod");

const env = require("../config/env");
const ApiError = require("../utils/ApiError");

const ai = env.geminiApiKey
  ? new GoogleGenAI({ apiKey: env.geminiApiKey })
  : null;

const responseSchema = {
  type: Type.OBJECT,
  required: [
    "atsScore",
    "scoreBreakdown",
    "issues",
    "strengths",
    "bulletRewrites",
    "keywordsPresent",
    "keywordsMissing",
    "summary",
  ],
  properties: {
    atsScore: { type: Type.NUMBER, description: "ATS-readiness score from 0 to 100" },
    scoreBreakdown: {
      type: Type.OBJECT,
      required: ["keywords", "formatting", "impact", "clarity"],
      properties: {
        keywords: { type: Type.NUMBER, description: "0-25" },
        formatting: { type: Type.NUMBER, description: "0-25" },
        impact: { type: Type.NUMBER, description: "0-25" },
        clarity: { type: Type.NUMBER, description: "0-25" },
      },
    },
    issues: {
      type: Type.ARRAY,
      description: "Exactly 5 prioritized issues",
      items: {
        type: Type.OBJECT,
        required: ["title", "severity", "explanation", "fix"],
        properties: {
          title: { type: Type.STRING },
          severity: { type: Type.STRING, enum: ["low", "medium", "high"] },
          explanation: { type: Type.STRING },
          fix: { type: Type.STRING },
        },
      },
    },
    strengths: {
      type: Type.ARRAY,
      description: "Exactly 5 strengths",
      items: {
        type: Type.OBJECT,
        required: ["title", "evidence"],
        properties: {
          title: { type: Type.STRING },
          evidence: { type: Type.STRING },
        },
      },
    },
    bulletRewrites: {
      type: Type.ARRAY,
      description: "5-10 weak bullets rewritten to be stronger and ATS-friendly",
      items: {
        type: Type.OBJECT,
        required: ["section", "original", "rewritten", "rationale"],
        properties: {
          section: { type: Type.STRING },
          original: { type: Type.STRING },
          rewritten: { type: Type.STRING },
          rationale: { type: Type.STRING },
        },
      },
    },
    keywordsPresent: { type: Type.ARRAY, items: { type: Type.STRING } },
    keywordsMissing: { type: Type.ARRAY, items: { type: Type.STRING } },
    summary: {
      type: Type.STRING,
      description: "One short paragraph overall verdict",
    },
  },
};

const analysisValidator = z.object({
  atsScore: z.number().min(0).max(100),
  scoreBreakdown: z.object({
    keywords: z.number().min(0).max(25),
    formatting: z.number().min(0).max(25),
    impact: z.number().min(0).max(25),
    clarity: z.number().min(0).max(25),
  }),
  issues: z
    .array(
      z.object({
        title: z.string(),
        severity: z.enum(["low", "medium", "high"]),
        explanation: z.string(),
        fix: z.string(),
      })
    )
    .min(1),
  strengths: z
    .array(z.object({ title: z.string(), evidence: z.string() }))
    .min(1),
  bulletRewrites: z
    .array(
      z.object({
        section: z.string(),
        original: z.string(),
        rewritten: z.string(),
        rationale: z.string(),
      })
    )
    .default([]),
  keywordsPresent: z.array(z.string()).default([]),
  keywordsMissing: z.array(z.string()).default([]),
  summary: z.string(),
});

function buildPrompt({ rawText, targetRole }) {
  return [
    "You are a senior technical recruiter and ATS expert reviewing a resume.",
    targetRole
      ? `Target role: ${targetRole}.`
      : "No specific target role was provided - assess for the role the candidate appears to be aiming for.",
    "",
    "Score the resume from 0-100 based on ATS readiness (keyword match, parseable formatting, quantified impact, clarity).",
    "Return exactly 5 prioritized issues, 5 standout strengths, and 5-10 weak bullets rewritten to be stronger, quantified, and ATS-friendly.",
    "Rewrites must preserve the original meaning. Each rewrite needs a one-line rationale.",
    "Identify keywords clearly present and notable keywords missing for the apparent target role.",
    "Be specific and evidence-based - cite phrasing from the resume in explanations.",
    "",
    "RESUME TEXT:",
    "----",
    rawText,
    "----",
  ].join("\n");
}

async function callGemini(prompt, schema = responseSchema, temperature = 0.4) {
  const result = await ai.models.generateContent({
    model: env.geminiModel,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature,
    },
  });

  const text =
    typeof result.text === "function" ? result.text() : result.text;
  if (!text) throw new Error("Empty response from Gemini");

  return {
    text,
    usage: result.usageMetadata || {},
  };
}


async function analyzeResume({ rawText, targetRole }) {
  if (!ai) {
    throw ApiError.internal(
      "GEMINI_API_KEY is not configured on the server."
    );
  }

  const prompt = buildPrompt({ rawText, targetRole });

  let lastErr;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { text, usage } = await callGemini(prompt);
      const parsed = JSON.parse(text);
      const validated = analysisValidator.parse(parsed);
      return {
        analysis: validated,
        model: env.geminiModel,
        promptTokens: usage.promptTokenCount,
        responseTokens: usage.candidatesTokenCount,
      };
    } catch (err) {
      lastErr = err;
      const status = Number(err?.status);
      const permanent = status >= 400 && status < 500 && status !== 429;
      if (permanent || attempt === 2) break;
    }
  }

  throw ApiError.internal(
    `Gemini analysis failed: ${lastErr?.message || "unknown error"}`
  );
}


// ---------------------------------------------------------------------------
// Resume optimizer: rewrites the resume for a target role and fixes every issue
// found by the analysis. Gemini only controls WORDING (headline, summary, skill
// grouping, bullets). All facts (names, dates, schools, links, tech, contact
// details) are copied from the original so nothing can be invented.
// ---------------------------------------------------------------------------

const optimizeSchema = {
  type: Type.OBJECT,
  required: ["title", "summary", "skillGroups", "experience", "projects", "changes", "todos"],
  properties: {
    title: {
      type: Type.STRING,
      description: "Role-specific professional headline, e.g. 'Full-Stack Developer (MERN)'. Max 8 words.",
    },
    summary: {
      type: Type.STRING,
      description: "2-3 sentence professional summary tailored to the target role. No first-person pronouns.",
    },
    skillGroups: {
      type: Type.ARRAY,
      description: "Skills grouped by category, most relevant to the target role first",
      items: {
        type: Type.OBJECT,
        required: ["category", "items"],
        properties: {
          category: { type: Type.STRING },
          items: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
      },
    },
    experience: {
      type: Type.ARRAY,
      description: "One entry per input experience item, SAME ORDER, with rewritten bullets",
      items: {
        type: Type.OBJECT,
        required: ["bullets"],
        properties: { bullets: { type: Type.ARRAY, items: { type: Type.STRING } } },
      },
    },
    projects: {
      type: Type.ARRAY,
      description: "One entry per input project, SAME ORDER, with 2-3 achievement bullets",
      items: {
        type: Type.OBJECT,
        required: ["bullets"],
        properties: { bullets: { type: Type.ARRAY, items: { type: Type.STRING } } },
      },
    },
    changes: {
      type: Type.ARRAY,
      description: "Short list of what was improved and which issue each change fixes",
      items: { type: Type.STRING },
    },
    todos: {
      type: Type.ARRAY,
      description: "Things only the candidate can add truthfully (real metrics, missing keywords they actually know)",
      items: { type: Type.STRING },
    },
  },
};

const optimizeValidator = z.object({
  title: z.string().default(""),
  summary: z.string().default(""),
  skillGroups: z
    .array(z.object({ category: z.string(), items: z.array(z.string()).default([]) }))
    .default([]),
  experience: z.array(z.object({ bullets: z.array(z.string()).default([]) })).default([]),
  projects: z.array(z.object({ bullets: z.array(z.string()).default([]) })).default([]),
  changes: z.array(z.string()).default([]),
  todos: z.array(z.string()).default([]),
});

function buildOptimizePrompt({ facts, rawText, analysis, targetRole }) {
  const issues = (analysis?.issues || [])
    .map((i, n) => `${n + 1}. [${i.severity}] ${i.title} - ${i.explanation} FIX: ${i.fix}`)
    .join("\n");
  const rewrites = (analysis?.bulletRewrites || [])
    .map((r) => `- "${r.original}" => "${r.rewritten}"`)
    .join("\n");

  return [
    "You are an expert resume writer and ATS specialist. Rewrite this candidate's resume content so it scores highly in Applicant Tracking Systems and reads as professional to recruiters.",
    targetRole
      ? `TARGET ROLE: ${targetRole}. Tailor the headline, summary, skill order and bullet emphasis to this role.`
      : "No target role was given - infer the most fitting role from the resume and tailor to it.",
    "",
    "HARD RULES (never break these):",
    "- Use ONLY facts present in the input. Never invent employers, dates, degrees, technologies, project features, links or numbers.",
    "- Do NOT add any number, percentage or metric that is not already in the input. If a bullet would be stronger with a metric, keep it qualitative and add a TODO asking the candidate to supply the real figure.",
    "- Skills: only list skills that appear in the input. Never add a missing keyword as a skill. If an important keyword is missing, mention it in TODOs as 'Add only if you genuinely have it: ...'.",
    "- Return exactly one experience entry per input experience item and exactly one project entry per input project, in the SAME ORDER.",
    "",
    "WRITING RULES:",
    "- Summary: 2-3 sentences, max 55 words, role-specific, no 'I'/'my', mention real strengths and the strongest project or degree.",
    "- Bullets: start with a strong past-tense action verb (present tense for current roles), one to two lines each, name the technologies actually used, show what was built and why it matters. Experience: 3-5 bullets each. Projects: 2-3 bullets each.",
    "- The headline must be honest for the candidate's level (e.g. a student: 'Computer Science Student | Full-Stack Developer (MERN)'); never claim seniority or years of experience that the resume does not show.",
    "- Plain ASCII-friendly punctuation, no emojis, no first person, no filler like 'responsible for' or 'worked on'.",
    "- Skill groups: 3-6 categories (e.g. Languages, Frontend, Backend, Databases, Tools & Concepts) with the most role-relevant first.",
    "- 'changes': 4-8 short lines naming what you improved and which analysis issue it addresses.",
    "- 'todos': 2-6 short lines for things only the candidate can supply truthfully.",
    "",
    "ISSUES FOUND BY THE ANALYSIS (address every one that wording can fix):",
    issues || "(none)",
    "",
    "KEYWORDS MISSING (do NOT add as skills; mention in todos only if relevant): " +
      ((analysis?.keywordsMissing || []).join(", ") || "(none)"),
    "",
    "SUGGESTED BULLET REWRITES (use as inspiration, keep meaning):",
    rewrites || "(none)",
    "",
    "STRUCTURED RESUME FACTS (JSON):",
    JSON.stringify(facts),
    "",
    "ORIGINAL RESUME TEXT (for reference):",
    "----",
    rawText,
    "----",
  ].join("\n");
}

const clean = (s) =>
  String(s || "")
    .replace(/^[\s\-\u2022*\u25CF\u25AA]+/, "")
    .replace(/\s+/g, " ")
    .trim();

function unsupportedNumbers(text, rawLower) {
  const nums = String(text).match(/(?<![\w.])\d[\d,]*(?:\.\d+)?/g) || [];
  return nums.filter((n) => !rawLower.includes(n.toLowerCase()));
}

function pickBullets(modelBullets, originalBullets, rawLower, flags) {
  const seen = new Set();
  const out = [];
  for (const b of modelBullets || []) {
    const t = clean(b);
    if (!t || t.length > 300 || seen.has(t.toLowerCase())) continue;
    if (unsupportedNumbers(t, rawLower).length) {
      flags.droppedNumeric += 1; // model invented a figure - discard that bullet
      continue;
    }
    seen.add(t.toLowerCase());
    out.push(t);
    if (out.length >= 5) break;
  }
  if (out.length) return out;
  return (originalBullets || []).map(clean).filter(Boolean);
}

function mergeOptimized({ original, rawText, model }) {
  const rawLower = String(rawText || "").toLowerCase();
  const flags = { droppedNumeric: 0 };
  const o = JSON.parse(JSON.stringify(original || {}));

  // Skills: keep only skills evidenced in the original; never lose an original skill.
  const origSkills = (o.skills || []).map(clean).filter(Boolean);
  const origSet = new Set(origSkills.map((s) => s.toLowerCase()));
  const used = new Set();
  const groups = [];
  for (const g of model.skillGroups || []) {
    const items = [];
    for (const it of g.items || []) {
      const t = clean(it);
      const k = t.toLowerCase();
      if (!t || used.has(k)) continue;
      if (origSet.has(k) || rawLower.includes(k)) {
        used.add(k);
        items.push(t);
      }
    }
    if (items.length && clean(g.category)) groups.push({ category: clean(g.category), items });
  }
  const leftovers = origSkills.filter((s) => !used.has(s.toLowerCase()));
  if (leftovers.length) {
    if (groups.length) groups.push({ category: "Additional Skills", items: leftovers });
    else groups.push({ category: "Technical Skills", items: leftovers });
  }
  const flatSkills = groups.flatMap((g) => g.items);

  const experience = (o.experience || []).map((e, i) => ({
    ...e,
    bullets: pickBullets(model.experience?.[i]?.bullets, e.bullets, rawLower, flags),
  }));

  const projects = (o.projects || []).map((p, i) => {
    const original = p.bullets?.length ? p.bullets : p.description ? [p.description] : [];
    const bullets = pickBullets(model.projects?.[i]?.bullets, original, rawLower, flags);
    return { ...p, bullets, description: bullets.join(" ") };
  });

  const summaryRaw = clean(model.summary);
  const titleRaw = clean(model.title);
  const basics = { ...(o.basics || {}) };
  if (titleRaw && titleRaw.length <= 80) basics.title = titleRaw;

  const changes = (model.changes || []).map(clean).filter(Boolean).slice(0, 8);
  const todos = (model.todos || []).map(clean).filter(Boolean).slice(0, 8);
  if (flags.droppedNumeric) {
    todos.push(
      `${flags.droppedNumeric} AI-suggested bullet(s) were discarded because they contained figures not in your resume - add your real numbers where you have them.`
    );
  }

  return {
    parsed: {
      ...o,
      basics,
      summary: summaryRaw && summaryRaw.length <= 600 ? summaryRaw : o.summary || "",
      skills: flatSkills.length ? flatSkills : origSkills,
      skillGroups: groups,
      experience,
      projects,
    },
    notes: { changes, todos: todos.slice(0, 9) },
  };
}

async function optimizeResume({ parsedSections, rawText, analysis, targetRole }) {
  if (!ai) {
    throw ApiError.internal("GEMINI_API_KEY is not configured on the server.");
  }

  const p = parsedSections || {};
  const facts = {
    basics: p.basics,
    summary: p.summary,
    skills: p.skills,
    experience: (p.experience || []).map((e, index) => ({
      index, company: e.company, role: e.role, period: e.period, bullets: e.bullets,
    })),
    projects: (p.projects || []).map((pr, index) => ({
      index, name: pr.name, tech: pr.tech, description: pr.description, bullets: pr.bullets,
    })),
    education: p.education,
    certifications: p.certifications,
  };

  const prompt = buildOptimizePrompt({ facts, rawText, analysis, targetRole });

  let lastErr;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { text } = await callGemini(prompt, optimizeSchema, 0.5);
      const model = optimizeValidator.parse(JSON.parse(text));
      if (!model.summary && !model.skillGroups.length && !model.experience.length && !model.projects.length) {
        throw new Error("Gemini returned an empty rewrite");
      }
      return mergeOptimized({ original: p, rawText, model });
    } catch (err) {
      lastErr = err;
      const status = Number(err?.status);
      if ((status >= 400 && status < 500 && status !== 429) || attempt === 2) break;
    }
  }
  throw ApiError.internal(`Resume optimization failed: ${lastErr?.message || "unknown error"}`);
}

module.exports = { analyzeResume, optimizeResume, callGemini };
