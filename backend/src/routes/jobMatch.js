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
const JobMatch = require("../models/JobMatch");
const { parseJobDescription } = require("../services/jobParser");
const { matchRequirements } = require("../services/matcher");
const { scoreMatch } = require("../services/scoring");
const gemini = require("../services/geminiService");

const router = express.Router();
router.use(requireAuth);

const oid = z.string().refine((v) => mongoose.isValidObjectId(v), { message: "Invalid id" });
const idParam = z.object({ id: oid });

const createBody = z.object({
  resumeId: oid,
  versionId: oid.optional(),
  jobTitle: z.string().trim().max(120).optional(),
  jobDescription: z
    .string()
    .trim()
    .min(80, "Paste the full job description (at least a few sentences).")
    .max(15000, "Job description is too long (max 15,000 characters).")
    .refine((s) => s.split(/\s+/).length >= 15, "Job description looks too short to analyze."),
});

const patchBody = z.object({
  clarification: z.enum(["have_skill", "dont_have", "unsure"]).nullable().optional(),
  text: z.string().trim().min(2).max(300).optional(),
  type: z.enum(["required", "preferred", "responsibility"]).optional(),
  remove: z.boolean().optional(),
});

function evaluate(requirements, version) {
  const parsed = version.parsedSections?.toObject ? version.parsedSections.toObject() : version.parsedSections;
  const results = matchRequirements(requirements, parsed, version.rawText);
  return { results, score: scoreMatch(requirements, results, parsed) };
}

async function loadOwnedMatch(req) {
  const m = await JobMatch.findOne({ _id: req.params.id, userId: req.user._id });
  if (!m) throw ApiError.notFound("Job match not found");
  return m;
}

router.post(
  "/",
  analyzeLimiter,
  validate(createBody),
  asyncHandler(async (req, res) => {
    const { resumeId, versionId, jobTitle, jobDescription } = req.body;
    const resume = await Resume.findOne({ _id: resumeId, userId: req.user._id });
    if (!resume) throw ApiError.notFound("Resume not found");
    const version = await ResumeVersion.findOne({
      _id: versionId || resume.currentVersionId,
      resumeId: resume._id,
    });
    if (!version) throw ApiError.notFound("Resume version not found");

    const parsedJd = await parseJobDescription(jobDescription, {
      title: jobTitle,
      callAi: process.env.GEMINI_API_KEY ? gemini.callGemini : null,
    });
    if (!parsedJd.requirements.length) {
      throw ApiError.badRequest(
        "We couldn't find any requirements in that text. Paste the full posting including the requirements/qualifications section."
      );
    }
    const requirements = parsedJd.requirements.map((r, i) => ({ ...r, id: `r${i + 1}`, clarification: null }));
    const { results, score } = evaluate(requirements, version);

    const match = await JobMatch.create({
      userId: req.user._id,
      resumeId: resume._id,
      versionId: version._id,
      jobTitle: parsedJd.jobTitle,
      seniority: parsedJd.seniority,
      jobDescription,
      parsedBy: parsedJd.parsedBy,
      warning: parsedJd.warning || "",
      requirements,
      results,
      score,
    });
    res.status(201).json({ match });
  })
);

router.get(
  "/",
  validate(z.object({ resumeId: oid }), "query"),
  asyncHandler(async (req, res) => {
    const matches = await JobMatch.find({ userId: req.user._id, resumeId: req.query.resumeId })
      .select("jobTitle seniority score.overall createdAt versionId parsedBy")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    res.json({ matches });
  })
);

router.get(
  "/:id",
  validate(idParam, "params"),
  asyncHandler(async (req, res) => {
    res.json({ match: await loadOwnedMatch(req) });
  })
);

// Correct an extracted requirement or answer a clarification; results are recomputed deterministically.
router.patch(
  "/:id/requirements/:reqId",
  validate(z.object({ id: oid, reqId: z.string().max(20) }), "params"),
  validate(patchBody),
  asyncHandler(async (req, res) => {
    const match = await loadOwnedMatch(req);
    const idx = match.requirements.findIndex((r) => r.id === req.params.reqId);
    if (idx < 0) throw ApiError.notFound("Requirement not found");

    const { clarification, text, type, remove } = req.body;
    if (remove) {
      if (match.requirements.length <= 1) throw ApiError.badRequest("A match needs at least one requirement.");
      match.requirements.splice(idx, 1);
    } else {
      const r = match.requirements[idx];
      if (clarification !== undefined) r.clarification = clarification;
      if (type) r.type = type;
      if (text) {
        r.text = text;
        if (r.category === "skill") r.skill = text.toLowerCase();
        r.needsReview = false;
      }
    }

    const version = await ResumeVersion.findOne({ _id: match.versionId, resumeId: match.resumeId });
    if (!version) throw ApiError.notFound("Resume version no longer exists");
    const reqs = match.requirements.map((r) => r.toObject());
    const { results, score } = evaluate(reqs, version);
    match.results = results;
    match.score = score;
    match.markModified("score");
    await match.save();
    res.json({ match });
  })
);

router.delete(
  "/:id",
  validate(idParam, "params"),
  asyncHandler(async (req, res) => {
    const match = await loadOwnedMatch(req);
    await match.deleteOne();
    res.json({ ok: true });
  })
);

module.exports = router;
