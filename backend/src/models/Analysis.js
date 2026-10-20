const mongoose = require("mongoose");

const issueSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    severity: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    explanation: String,
    fix: String,
  },
  { _id: false }
);

const strengthSchema = new mongoose.Schema(
  { title: { type: String, required: true }, evidence: String },
  { _id: false }
);

const bulletRewriteSchema = new mongoose.Schema(
  {
    section: String, // e.g. "experience"
    original: { type: String, required: true },
    rewritten: { type: String, required: true },
    rationale: String,
  },
  { _id: true } // we want ids so frontend can target individual rewrites
);

const scoreBreakdownSchema = new mongoose.Schema(
  {
    keywords: { type: Number, min: 0, max: 25, default: 0 },
    formatting: { type: Number, min: 0, max: 25, default: 0 },
    impact: { type: Number, min: 0, max: 25, default: 0 },
    clarity: { type: Number, min: 0, max: 25, default: 0 },
  },
  { _id: false }
);

const analysisSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    resumeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Resume",
      required: true,
      index: true,
    },
    versionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ResumeVersion",
      required: true,
      index: true,
    },
    targetRole: { type: String, default: "" },
    atsScore: { type: Number, min: 0, max: 100, required: true },
    scoreBreakdown: scoreBreakdownSchema,
    issues: { type: [issueSchema], default: [] },
    strengths: { type: [strengthSchema], default: [] },
    bulletRewrites: { type: [bulletRewriteSchema], default: [] },
    keywordsPresent: { type: [String], default: [] },
    keywordsMissing: { type: [String], default: [] },
    summary: { type: String, default: "" },
    model: { type: String, required: true },
    promptTokens: Number,
    responseTokens: Number,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Analysis", analysisSchema);
