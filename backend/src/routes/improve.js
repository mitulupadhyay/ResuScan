const express = require("express");
const { z } = require("zod");
const mongoose = require("mongoose");

const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { requireAuth } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { analyzeLimiter } = require("../middleware/rateLimit");
const Resume = require("../models/Resume");
const ResumeVersion = require("../models/ResumeVersion");
const gemini = require("../services/geminiService");
const { resumeToText } = require("../services/resumeText");
const imp = require("../services/bulletImprover");

const router = express.Router();
router.use(requireAuth);

const oid = z.string().refine((v) => mongoose.isValidObjectId(v), { message: "Invalid id" });
const fact = z.string().trim().max(1500).optional();
const factsSchema = z.object({ problem: fact, contribution: fact, technologies: fact, details: fact, challenges: fact, results: fact }).default({});
const target = z.object({
  resumeId: oid,
  versionId: oid.optional(),
  itemType: z.enum(["project", "experience"]),
  itemIndex: z.number().int().min(0).max(50),
  facts: factsSchema,
});
const applyBody = target.extend({
  mode: z.enum(["replace", "append"]).default("replace"),
  bullets: z.array(z.string().trim().min(5).max(320)).min(1, "Select at least one bullet to apply.").max(5),
});

async function load(req) {
  const { resumeId, versionId, itemType, itemIndex } = req.body;
  const resume = await Resume.findOne({ _id: resumeId, userId: req.user._id });
  if (!resume) throw ApiError.notFound("Resume not found");
  const version = await ResumeVersion.findOne({ _id: versionId || resume.currentVersionId, resumeId: resume._id });
  if (!version) throw ApiError.notFound("Resume version not found");
  const parsed = version.parsedSections?.toObject ? version.parsedSections.toObject() : version.parsedSections;
  const item = imp.getItem(parsed, itemType, itemIndex);
  if (!item) throw ApiError.notFound(`No ${itemType} at position ${itemIndex + 1} in this version`);
  return { resume, version, parsed, item, facts: imp.mergeFacts(item, req.body.facts) };
}

// Prefill from the resume + tell the student what is still missing. Pure and deterministic; no AI call.
router.post("/assess", validate(target), asyncHandler(async (req, res) => {
  const { item, facts } = await load(req);
  res.json({ item, facts, ...imp.assessFacts(facts) });
}));

// Suggest bullets. Refuses to run on vague input; never writes anything to the resume.
router.post("/generate", analyzeLimiter, validate(target), asyncHandler(async (req, res) => {
  const { version, item, facts } = await load(req);
  const a = imp.assessFacts(facts);
  if (!a.ready) throw ApiError.conflict("We need a few more details before writing a truthful bullet.", { questions: a.questions });
  const out = await imp.generateBullets({
    item, facts, targetRole: version.targetRole || "",
    callAi: process.env.GEMINI_API_KEY ? (...args) => gemini.callGemini(...args) : () => { throw new Error("no key"); },
  });
  res.json(out);
}));

// Accept: re-checks the (possibly user-edited) bullets against the supplied facts, then saves a NEW version.
router.post("/apply", validate(applyBody), asyncHandler(async (req, res) => {
  const { resume, version, parsed, item, facts } = await load(req);
  const corpus = imp.buildCorpus(facts, item);
  const hasResults = !!facts.results.trim();
  for (const b of req.body.bullets) {
    const bad = imp.findUnsupportedClaims(b, corpus, { hasResults });
    if (bad.length) {
      throw ApiError.badRequest(`"${b.slice(0, 60)}…" mentions ${bad.join(", ")}, which isn't in your details. Add it to your facts if it's true, or remove it.`, { unsupported: bad });
    }
  }

  const next = JSON.parse(JSON.stringify(parsed));
  const target = req.body.itemType === "project" ? next.projects[req.body.itemIndex] : next.experience[req.body.itemIndex];
  const merged = req.body.mode === "append" ? [...item.bullets, ...req.body.bullets] : req.body.bullets;
  target.bullets = merged.slice(0, 8);
  if (req.body.itemType === "project") target.description = target.bullets.join(" ");

  const n = resume.latestVersionNumber + 1;
  const created = await ResumeVersion.create({
    resumeId: resume._id,
    versionNumber: n,
    label: `V${n}`,
    rawText: resumeToText(next),
    parsedSections: next,
    sourceType: "rewrite",
    parentVersionId: version._id,
    targetRole: version.targetRole || "",
    notes: { changes: [`${req.body.mode === "append" ? "Added" : "Replaced"} ${req.body.bullets.length} reviewed bullet(s) for "${item.name}" using details you provided.`], todos: [] },
  });
  resume.latestVersionNumber = n;
  resume.currentVersionId = created._id;
  await resume.save();
  res.status(201).json({ version: created });
}));

module.exports = router;
