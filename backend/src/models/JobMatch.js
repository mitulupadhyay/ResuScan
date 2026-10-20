const mongoose = require("mongoose");

const requirementSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    type: { type: String, enum: ["required", "preferred", "responsibility"], default: "required" },
    category: { type: String, default: "qualification" },
    skill: { type: String, default: "" },
    sourceSentence: { type: String, default: "" },
    needsReview: { type: Boolean, default: false },
    clarification: { type: String, enum: ["have_skill", "dont_have", "unsure", null], default: null },
  },
  { _id: false }
);

const resultSchema = new mongoose.Schema(
  {
    requirementId: String,
    status: { type: String, enum: ["matched", "partial", "needs_review", "not_evidenced"] },
    evidence: [{ _id: false, section: String, text: String, kind: String }],
    reason: String,
    nextAction: String,
    gapType: { type: String, default: null },
  },
  { _id: false }
);

const jobMatchSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    resumeId: { type: mongoose.Schema.Types.ObjectId, ref: "Resume", required: true, index: true },
    versionId: { type: mongoose.Schema.Types.ObjectId, ref: "ResumeVersion", required: true },
    jobTitle: { type: String, default: "" },
    seniority: { type: String, default: "unspecified" },
    jobDescription: { type: String, required: true },
    parsedBy: { type: String, enum: ["ai", "heuristic"], default: "heuristic" },
    warning: { type: String, default: "" },
    requirements: [requirementSchema],
    results: [resultSchema],
    score: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

jobMatchSchema.index({ resumeId: 1, createdAt: -1 });

module.exports = mongoose.model("JobMatch", jobMatchSchema);
