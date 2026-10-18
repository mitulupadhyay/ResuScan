const express = require("express");

const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");

const Resume = require("../models/Resume");
const ResumeVersion = require("../models/ResumeVersion");
const Analysis = require("../models/Analysis");

const router = express.Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const resumes = await Resume.find({ userId }).sort({ updatedAt: -1 }).lean();
    const resumeIds = resumes.map((r) => r._id);

    const [rewriteCount, analysisCount] = await Promise.all([
      ResumeVersion.countDocuments({
        resumeId: { $in: resumeIds },
        sourceType: "rewrite",
      }),
      Analysis.countDocuments({ userId }),
    ]);

    const latestResumeMeta = resumes[0] || null;

    let latestResume = null;
    let scoreSeries = [];
    let versionStack = [];

    if (latestResumeMeta) {
      const versions = await ResumeVersion.find({
        resumeId: latestResumeMeta._id,
      })
        .sort({ versionNumber: 1 })
        .lean();

      const analysisIds = versions.map((v) => v.latestAnalysisId).filter(Boolean);
      const analyses = analysisIds.length
        ? await Analysis.find({ _id: { $in: analysisIds } })
            .select("_id atsScore versionId createdAt")
            .lean()
        : [];
      const scoreByVersion = new Map(
        analyses.map((a) => [a.versionId.toString(), a.atsScore])
      );

      const versionsWithScores = versions.map((v) => ({
        id: v._id,
        label: v.label,
        versionNumber: v.versionNumber,
        sourceType: v.sourceType,
        createdAt: v.createdAt,
        score: scoreByVersion.get(v._id.toString()) ?? null,
      }));

      latestResume = {
        _id: latestResumeMeta._id,
        title: latestResumeMeta.title,
        latestVersionNumber: latestResumeMeta.latestVersionNumber,
        updatedAt: latestResumeMeta.updatedAt,
        currentVersionId: latestResumeMeta.currentVersionId,
      };

      scoreSeries = versionsWithScores
        .filter((v) => v.score != null)
        .map((v) => ({
          label: v.label,
          score: v.score,
          versionId: v.id,
          at: v.createdAt,
        }));

      versionStack = versionsWithScores.map((v, i, arr) => {
        const prev = arr[i - 1];
        const delta =
          v.score != null && prev?.score != null ? v.score - prev.score : 0;
        return {
          id: v.id,
          label: v.label,
          title:
            v.sourceType === "upload"
              ? "Upload"
              : v.sourceType === "rewrite"
              ? "Rewrite pass"
              : v.label,
          score: v.score ?? 0,
          delta,
        };
      });
    }

    // KPIs derived from history
    const allAnalyses = await Analysis.find({ userId })
      .select("atsScore keywordsPresent keywordsMissing issues createdAt resumeId")
      .sort({ createdAt: 1 })
      .lean();

    const latestAnalysis = allAnalyses[allAnalyses.length - 1] || null;
    const prevAnalysis = allAnalyses[allAnalyses.length - 2] || null;

    const scoreSpark = allAnalyses.slice(-10).map((a) => ({ v: a.atsScore }));
    const versionsSpark = resumes
      .slice(0, 10)
      .reverse()
      .map((r) => ({ v: r.latestVersionNumber || 1 }));
    const keywordsSpark = allAnalyses
      .slice(-10)
      .map((a) => ({ v: (a.keywordsPresent || []).length }));
    const issuesSpark = allAnalyses
      .slice(-10)
      .map((a) => ({ v: (a.issues || []).length }));

    const kpi = {
      atsScore: {
        value: latestAnalysis?.atsScore ?? null,
        delta:
          latestAnalysis && prevAnalysis
            ? latestAnalysis.atsScore - prevAnalysis.atsScore
            : null,
        spark: scoreSpark,
      },
      versions: {
        value: resumes.reduce((sum, r) => sum + (r.latestVersionNumber || 1), 0),
        delta: null,
        spark: versionsSpark,
      },
      issuesIdentified: {
        value: latestAnalysis ? latestAnalysis.issues?.length || 0 : null,
        delta:
          latestAnalysis && prevAnalysis
            ? (latestAnalysis.issues?.length || 0) -
              (prevAnalysis.issues?.length || 0)
            : null,
        spark: issuesSpark,
      },
      keywordsMatched: {
        value: latestAnalysis ? latestAnalysis.keywordsPresent?.length || 0 : null,
        total: latestAnalysis
          ? (latestAnalysis.keywordsPresent?.length || 0) +
            (latestAnalysis.keywordsMissing?.length || 0)
          : null,
        delta:
          latestAnalysis && prevAnalysis
            ? (latestAnalysis.keywordsPresent?.length || 0) -
              (prevAnalysis.keywordsPresent?.length || 0)
            : null,
        spark: keywordsSpark,
      },
    };

    const resumeMap = new Map(resumes.map((r) => [r._id.toString(), r]));

    const [recentVersions, recentAnalyses] = await Promise.all([
      ResumeVersion.find({ resumeId: { $in: resumeIds } })
        .sort({ createdAt: -1 })
        .limit(10)
        .select("resumeId label versionNumber sourceType createdAt")
        .lean(),
      Analysis.find({ userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .select("resumeId versionId atsScore createdAt")
        .lean(),
    ]);

    const events = [];

    for (const r of resumes.slice(0, 10)) {
      events.push({
        id: `r-${r._id}`,
        type: "upload",
        title: `${r.title} uploaded`,
        subtitle: "Parsed and version V1 created",
        label: "V1",
        at: r.createdAt,
        resumeId: r._id,
      });
    }

    for (const v of recentVersions) {
      if (v.sourceType !== "rewrite") continue;
      const resume = resumeMap.get(v.resumeId.toString());
      events.push({
        id: `v-${v._id}`,
        type: "rewrite",
        title: `${v.label} created for ${resume?.title || "resume"}`,
        subtitle: "Rewrites applied",
        label: `${v.label} created`,
        at: v.createdAt,
        resumeId: v.resumeId,
      });
    }

    for (const a of recentAnalyses) {
      const resume = resumeMap.get(a.resumeId.toString());
      events.push({
        id: `a-${a._id}`,
        type: "analyze",
        title: `Analysis complete on ${resume?.title || "resume"}`,
        subtitle: `ATS score ${a.atsScore} / 100`,
        label: `${a.atsScore}`,
        at: a.createdAt,
        resumeId: a.resumeId,
      });
    }

    const activity = events
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 8);

    res.json({
      totals: {
        resumes: resumes.length,
        rewrites: rewriteCount,
        analyses: analysisCount,
        exports: 0,
      },
      latestResume,
      scoreSeries,
      versionStack,
      kpi,
      activity,
    });
  })
);

module.exports = router;