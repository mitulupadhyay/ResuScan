const express = require("express");
const { z } = require("zod");
const mongoose = require("mongoose");

const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { requireAuth } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { uploadPdf, uploadResume } = require("../middleware/upload");
const { analyzeLimiter, uploadLimiter } = require("../middleware/rateLimit");

const Resume = require("../models/Resume");
const ResumeVersion = require("../models/ResumeVersion");
const Analysis = require("../models/Analysis");
const JobMatch = require("../models/JobMatch");

const { extractText } = require("../services/pdfService");
const { parseResume: parseStructured } = require("../services/structuredParser");
const { optimizeResume } = require("../services/geminiService");
const { isThinParse, resumeToText } = require("../services/resumeText");
const { normalizeSections } = require("../services/sectionsSchema");
const { extractPlain } = require("../services/pdfService");
const { extractDocxText } = require("../services/docxService");
const { validateExport } = require("../services/exportValidator");
const { analyzeResume } = require("../services/geminiService");

const { diffText, summarize } = require("../services/diffService");


const router = express.Router();
router.use(requireAuth);

const objectIdSchema = z
  .string()
  .refine((v) => mongoose.isValidObjectId(v), { message: "Invalid id" });

const idParam = z.object({ id: objectIdSchema });

async function loadOwnedResume(req) {
  const resume = await Resume.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });
  if (!resume) throw ApiError.notFound("Resume not found");
  return resume;
}

async function loadVersion(resumeId, versionId) {
  const version = await ResumeVersion.findOne({ _id: versionId, resumeId });
  if (!version) throw ApiError.notFound("Version not found");
  return version;
}

router.post(
  "/",
  uploadLimiter,
  uploadResume("file"),
  asyncHandler(async (req, res) => {
    const { text, meta } =
      req.file.kind === "docx"
        ? await extractDocxText(req.file.buffer)
        : await extractText(req.file.buffer);
    const parsedSections = await parseStructured(text);

    const title =
      (req.body.title || "").trim() ||
      req.file.originalname.replace(/\.(pdf|docx)$/i, "") ||
      "Untitled Resume";

    const resume = await Resume.create({
      userId: req.user._id,
      title,
      latestVersionNumber: 1,
    });

    const version = await ResumeVersion.create({
      resumeId: resume._id,
      versionNumber: 1,
      label: "V1",
      rawText: text,
      parsedSections,
      sourceType: "upload",
      parentVersionId: null,
    });

    resume.currentVersionId = version._id;
    await resume.save();

    res.status(201).json({ resume, version, meta });
  })
);

// Start from scratch: an empty, editable resume seeded with the account's name and email.
router.post(
  "/blank",
  validate(z.object({ title: z.string().trim().max(120).optional() })),
  asyncHandler(async (req, res) => {
    const parsed = normalizeSections({ basics: { name: req.user.name, email: req.user.email } });
    const resume = await Resume.create({
      userId: req.user._id,
      title: req.body.title || "My Resume",
      latestVersionNumber: 1,
    });
    const version = await ResumeVersion.create({
      resumeId: resume._id,
      versionNumber: 1,
      label: "V1",
      rawText: resumeToText(parsed),
      parsedSections: parsed,
      sourceType: "edit",
      parentVersionId: null,
    });
    resume.currentVersionId = version._id;
    await resume.save();
    res.status(201).json({ resume, version });
  })
);


router.get(
  "/",
  asyncHandler(async (req, res) => {
    const resumes = await Resume.find({ userId: req.user._id })
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ resumes });
  })
);

router.get(
  "/:id",
  validate(idParam, "params"),
  asyncHandler(async (req, res) => {
    const resume = await loadOwnedResume(req);
    const versions = await ResumeVersion.find({ resumeId: resume._id })
      .sort({ versionNumber: 1 })
      .select("-rawText")
      .lean();
    res.json({ resume, versions });
  })
);

router.get(
  "/:id/versions/:versionId",
  validate(
    z.object({ id: objectIdSchema, versionId: objectIdSchema }),
    "params"
  ),
  asyncHandler(async (req, res) => {
    const resume = await loadOwnedResume(req);
    const version = await loadVersion(resume._id, req.params.versionId);
    res.json({ version });
  })
);

router.get(
  "/:id/analyses",
  validate(idParam, "params"),
  asyncHandler(async (req, res) => {
    const resume = await loadOwnedResume(req);
    const analyses = await Analysis.find({ resumeId: resume._id })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ analyses });
  })
);

router.get(
  "/:id/versions/:versionId/analysis",
  validate(
    z.object({ id: objectIdSchema, versionId: objectIdSchema }),
    "params"
  ),
  asyncHandler(async (req, res) => {
    const resume = await loadOwnedResume(req);
    const version = await loadVersion(resume._id, req.params.versionId);
    const analysis = await Analysis.findOne({
      resumeId: resume._id,
      versionId: version._id,
    })
      .sort({ createdAt: -1 })
      .lean();
    if (!analysis) throw ApiError.notFound("No analysis for this version yet");
    res.json({ analysis });
  })
);

router.delete(
  "/:id",
  validate(idParam, "params"),
  asyncHandler(async (req, res) => {
    const resume = await loadOwnedResume(req);
    await Analysis.deleteMany({ resumeId: resume._id });
    await JobMatch.deleteMany({ resumeId: resume._id });
    await ResumeVersion.deleteMany({ resumeId: resume._id });
    await resume.deleteOne();
    res.json({ ok: true });
  })
);

const analyzeBody = z.object({
  versionId: objectIdSchema.optional(),
  targetRole: z.string().trim().max(120).optional(),
});

router.post(
  "/:id/analyze",
  analyzeLimiter,
  validate(idParam, "params"),
  validate(analyzeBody),
  asyncHandler(async (req, res) => {
    const resume = await loadOwnedResume(req);

    const versionId = req.body.versionId || resume.currentVersionId;
    if (!versionId) throw ApiError.badRequest("No version to analyze");
    const version = await loadVersion(resume._id, versionId);

    const { analysis, model, promptTokens, responseTokens } =
      await analyzeResume({
        rawText: version.rawText,
        targetRole: req.body.targetRole,
      });

    const saved = await Analysis.create({
      userId: req.user._id,
      resumeId: resume._id,
      versionId: version._id,
      targetRole: req.body.targetRole || "",
      atsScore: analysis.atsScore,
      scoreBreakdown: analysis.scoreBreakdown,
      issues: analysis.issues,
      strengths: analysis.strengths,
      bulletRewrites: analysis.bulletRewrites,
      keywordsPresent: analysis.keywordsPresent,
      keywordsMissing: analysis.keywordsMissing,
      summary: analysis.summary,
      model,
      promptTokens,
      responseTokens,
    });

    version.latestAnalysisId = saved._id;
    await version.save();

    res.status(201).json({ analysis: saved });
  })
);

<<<<<<< HEAD
=======
const optimizeBody = z.object({
  analysisId: objectIdSchema.optional(),
  targetRole: z.string().trim().max(120).optional(),
});

// Build a complete, role-targeted, ATS-optimized version from an analysis.
router.post(
  "/:id/optimize",
  analyzeLimiter,
  validate(idParam, "params"),
  validate(optimizeBody),
  asyncHandler(async (req, res) => {
    const resume = await loadOwnedResume(req);

    const analysis = req.body.analysisId
      ? await Analysis.findOne({ _id: req.body.analysisId, resumeId: resume._id })
      : await Analysis.findOne({
          resumeId: resume._id,
          versionId: resume.currentVersionId,
        }).sort({ createdAt: -1 });
    if (!analysis) {
      throw ApiError.badRequest("Run an analysis first - the optimizer fixes the issues it finds.");
    }

    const base = await loadVersion(resume._id, analysis.versionId);

    // Older uploads may have been parsed while Gemini was unavailable.
    if (isThinParse(base.parsedSections)) {
      try {
        base.parsedSections = await parseStructured(base.rawText, { strict: true });
        await base.save();
      } catch (err) {
        throw ApiError.badRequest(
          `Couldn't read this resume's structure (${err.message}). Try re-uploading the PDF.`
        );
      }
      if (isThinParse(base.parsedSections)) {
        throw ApiError.badRequest("Couldn't extract any resume sections from this version. Try re-uploading the PDF.");
      }
    }

    const targetRole = req.body.targetRole || analysis.targetRole || "";
    const { parsed, notes } = await optimizeResume({
      parsedSections: base.parsedSections.toObject
        ? base.parsedSections.toObject()
        : base.parsedSections,
      rawText: base.rawText,
      analysis: analysis.toObject(),
      targetRole,
    });

    const nextNumber = resume.latestVersionNumber + 1;
    const version = await ResumeVersion.create({
      resumeId: resume._id,
      versionNumber: nextNumber,
      label: `V${nextNumber}`,
      rawText: resumeToText(parsed),
      parsedSections: parsed,
      sourceType: "rewrite",
      parentVersionId: base._id,
      targetRole,
      notes,
    });

    resume.latestVersionNumber = nextNumber;
    resume.currentVersionId = version._id;
    await resume.save();

    res.status(201).json({ version, notes, targetRole });
  })
);

// Re-run structured parsing on a stored version (fixes resumes parsed while Gemini was down).
router.post(
  "/:id/versions/:versionId/reparse",
  analyzeLimiter,
  validate(z.object({ id: objectIdSchema, versionId: objectIdSchema }), "params"),
  asyncHandler(async (req, res) => {
    const resume = await loadOwnedResume(req);
    const version = await loadVersion(resume._id, req.params.versionId);
    try {
      version.parsedSections = await parseStructured(version.rawText, { strict: true });
    } catch (err) {
      throw ApiError.badRequest(`Re-parse failed: ${err.message}`);
    }
    await version.save();
    res.json({ version });
  })
);

// Re-extract text from the exported PDF and compare it with the saved content. Stores nothing.
router.post(
  "/:id/versions/:versionId/validate-export",
  validate(z.object({ id: objectIdSchema, versionId: objectIdSchema }), "params"),
  uploadPdf("file"),
  asyncHandler(async (req, res) => {
    const resume = await loadOwnedResume(req);
    const version = await loadVersion(resume._id, req.params.versionId);
    const { text, numPages } = await extractPlain(req.file.buffer);
    const parsed = version.parsedSections?.toObject ? version.parsedSections.toObject() : version.parsedSections;
    res.json({ report: validateExport(parsed, text, { numPages }) });
  })
);

const sectionsBody = z.object({ sections: z.unknown() });

// Save user corrections as a NEW version - the original is never modified.
router.put(
  "/:id/versions/:versionId/sections",
  validate(z.object({ id: objectIdSchema, versionId: objectIdSchema }), "params"),
  validate(sectionsBody),
  asyncHandler(async (req, res) => {
    const resume = await loadOwnedResume(req);
    const base = await loadVersion(resume._id, req.params.versionId);

    let next;
    try {
      next = normalizeSections(req.body.sections);
    } catch (err) {
      const first = err.issues?.[0];
      throw ApiError.badRequest(
        first ? `${first.path.join(".") || "sections"}: ${first.message}` : "Invalid resume sections"
      );
    }

    const prev = base.parsedSections?.toObject ? base.parsedSections.toObject() : base.parsedSections;
    let prevNorm = null;
    try { prevNorm = normalizeSections(prev); } catch { /* old data that no longer validates: treat as changed */ }
    if (prevNorm && JSON.stringify(prevNorm) === JSON.stringify(next)) {
      return res.json({ version: base, unchanged: true });
    }

    const nextNumber = resume.latestVersionNumber + 1;
    const version = await ResumeVersion.create({
      resumeId: resume._id,
      versionNumber: nextNumber,
      label: `V${nextNumber}`,
      rawText: resumeToText(next),
      parsedSections: next,
      sourceType: "edit",
      parentVersionId: base._id,
      targetRole: base.targetRole || "",
    });
    resume.latestVersionNumber = nextNumber;
    resume.currentVersionId = version._id;
    await resume.save();
    res.status(201).json({ version });
  })
);

// Restore = copy an old version forward as the newest one. History is never rewritten.
router.post(
  "/:id/versions/:versionId/restore",
  validate(z.object({ id: objectIdSchema, versionId: objectIdSchema }), "params"),
  asyncHandler(async (req, res) => {
    const resume = await loadOwnedResume(req);
    const old = await loadVersion(resume._id, req.params.versionId);
    if (String(resume.currentVersionId) === String(old._id)) {
      throw ApiError.badRequest(`${old.label} is already the current version.`);
    }
    const nextNumber = resume.latestVersionNumber + 1;
    const version = await ResumeVersion.create({
      resumeId: resume._id,
      versionNumber: nextNumber,
      label: `V${nextNumber}`,
      rawText: old.rawText,
      parsedSections: old.parsedSections?.toObject ? old.parsedSections.toObject() : old.parsedSections,
      sourceType: "restore",
      parentVersionId: old._id,
      targetRole: old.targetRole || "",
      notes: old.notes?.toObject ? old.notes.toObject() : old.notes,
    });
    resume.latestVersionNumber = nextNumber;
    resume.currentVersionId = version._id;
    await resume.save();
    res.status(201).json({ version, restoredFrom: old.label });
  })
);

>>>>>>> 12ed780 (feat: custom section order, security headers, frontend unit tests)
const rewriteBody = z.object({
  analysisId: objectIdSchema,
  rewriteIds: z.array(objectIdSchema).optional(), // omit/empty = apply all
  label: z.string().trim().max(40).optional(),
});

function applyRewritesToText(rawText, rewrites) {
  let result = rawText;
  for (const r of rewrites) {
    if (!r.original || !r.rewritten) continue;
    const idx = result.indexOf(r.original);
    if (idx >= 0) {
      result = result.slice(0, idx) + r.rewritten + result.slice(idx + r.original.length);
    } else {
      // Fallback: append as a strengthened alternative line
      result += `\n${r.rewritten}`;
    }
  }
  return result;
}

function patchBulletsInSections(sections, rewrites) {
  if (!sections) return null;
  const cloned = JSON.parse(JSON.stringify(sections));
  for (const r of rewrites) {
    if (!r?.original || !r?.rewritten) continue;
    for (const exp of cloned.experience || []) {
      if (!Array.isArray(exp.bullets)) continue;
      exp.bullets = exp.bullets.map((b) =>
        b === r.original ? r.rewritten : b
      );
    }
  }
  return cloned;
}

function looksEmpty(sections) {
  if (!sections) return true;
  const b = sections.basics || {};
  const hasIdentity = b.name || b.email || b.title;
  const hasBody =
    sections.summary ||
    sections.experience?.length ||
    sections.education?.length ||
    sections.skills?.length;
  return !hasIdentity && !hasBody;
}

router.post(
  "/:id/rewrite",
  validate(idParam, "params"),
  validate(rewriteBody),
  asyncHandler(async (req, res) => {
    const resume = await loadOwnedResume(req);

    const analysis = await Analysis.findOne({
      _id: req.body.analysisId,
      resumeId: resume._id,
    });
    if (!analysis) throw ApiError.notFound("Analysis not found");

    const baseVersion = await loadVersion(resume._id, analysis.versionId);

    const selected = req.body.rewriteIds?.length
      ? analysis.bulletRewrites.filter((r) =>
          req.body.rewriteIds.includes(r._id.toString())
        )
      : analysis.bulletRewrites;

    if (!selected.length) {
      throw ApiError.badRequest("No rewrites selected to apply");
    }

    const newRaw = applyRewritesToText(baseVersion.rawText, selected);

    // Safety net: pre-build a structured copy from the base version with the
    // chosen bullets swapped in, so V2 never lands with empty sections even if
    // Gemini's re-parse fails.
    const patchedFromBase = patchBulletsInSections(
      baseVersion.parsedSections,
      selected
    );
    const reparsed = await parseStructured(newRaw);
    const finalParsed = looksEmpty(reparsed) ? patchedFromBase : reparsed;

    const nextNumber = resume.latestVersionNumber + 1;

    const newVersion = await ResumeVersion.create({
      resumeId: resume._id,
      versionNumber: nextNumber,
      label: req.body.label?.trim() || `V${nextNumber}`,
      rawText: newRaw,
      parsedSections: finalParsed,
      sourceType: "rewrite",
      parentVersionId: baseVersion._id,
    });

    resume.latestVersionNumber = nextNumber;
    resume.currentVersionId = newVersion._id;
    await resume.save();

    res.status(201).json({
      version: newVersion,
      appliedCount: selected.length,
    });
  })
);

const diffQuery = z.object({
  from: objectIdSchema,
  to: objectIdSchema,
  mode: z.enum(["words", "lines"]).optional(),
});

router.get(
  "/:id/diff",
  validate(idParam, "params"),
  validate(diffQuery, "query"),
  asyncHandler(async (req, res) => {
    const resume = await loadOwnedResume(req);
    const [fromV, toV] = await Promise.all([
      loadVersion(resume._id, req.query.from),
      loadVersion(resume._id, req.query.to),
    ]);

    const parts = diffText(fromV.rawText, toV.rawText, req.query.mode);
    res.json({
      from: { id: fromV._id, label: fromV.label, versionNumber: fromV.versionNumber },
      to: { id: toV._id, label: toV.label, versionNumber: toV.versionNumber },
      parts,
      stats: summarize(parts),
    });
  })
);

module.exports = router;