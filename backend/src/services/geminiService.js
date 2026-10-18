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

async function callGemini(prompt) {
  const result = await ai.models.generateContent({
    model: env.geminiModel,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.4,
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

module.exports = { analyzeResume };
