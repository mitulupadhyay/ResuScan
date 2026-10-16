// Mock cross-resume analytics payloads (Insights / Versions / History pages).
// Delete this file once the backend is connected.

import { minutesAgo, hoursAgo, daysAgo } from "./_helpers";

export const mockInsights = {
  averageScore: 73,
  bestScore: { value: 86, resumeId: "resume_1", resumeTitle: "Senior Frontend Engineer — Stripe" },
  totalAnalyses: 12,
  scoreTrend: [
    { score: 58, at: daysAgo(34), resumeTitle: "Vercel" },
    { score: 62, at: daysAgo(20), resumeTitle: "Stripe" },
    { score: 71, at: daysAgo(60), resumeTitle: "Notion" },
    { score: 74, at: daysAgo(3), resumeTitle: "Vercel" },
    { score: 78, at: daysAgo(8), resumeTitle: "Stripe" },
    { score: 82, at: daysAgo(2), resumeTitle: "Stripe" },
    { score: 86, at: hoursAgo(2), resumeTitle: "Stripe" },
  ],
  topIssues: [
    { title: "Weak action verbs", severity: "high", count: 8 },
    { title: "Missing keywords for target role", severity: "high", count: 6 },
    { title: "Inconsistent date formatting", severity: "medium", count: 5 },
    { title: "Bullets too long", severity: "low", count: 4 },
    { title: "No quantified outcomes", severity: "high", count: 3 },
  ],
  topMissingKeywords: [
    { keyword: "GraphQL", count: 7 },
    { keyword: "Docker", count: 6 },
    { keyword: "Kubernetes", count: 4 },
    { keyword: "Redis", count: 3 },
    { keyword: "PostgreSQL", count: 2 },
  ],
  topPresentKeywords: [
    { keyword: "React", count: 12 },
    { keyword: "TypeScript", count: 11 },
    { keyword: "Node.js", count: 9 },
    { keyword: "AWS", count: 7 },
    { keyword: "Vite", count: 5 },
  ],
  resumePerformance: [
    { resumeId: "resume_1", title: "Senior Frontend — Stripe", latestScore: 86, bestScore: 86, improvement: 24, analysesCount: 5 },
    { resumeId: "resume_2", title: "Full-Stack — Vercel", latestScore: 74, bestScore: 74, improvement: 16, analysesCount: 4 },
    { resumeId: "resume_3", title: "React — Notion", latestScore: 71, bestScore: 71, improvement: 0, analysesCount: 3 },
  ],
};

export const mockAllVersions = {
  totals: { all: 6, uploads: 3, rewrites: 3 },
  versions: [
    { id: "v_1_3", label: "V3", resumeId: "resume_1", resumeTitle: "Stripe", sourceType: "rewrite", score: 86, createdAt: hoursAgo(2) },
    { id: "v_2_2", label: "V2", resumeId: "resume_2", resumeTitle: "Vercel", sourceType: "rewrite", score: 74, createdAt: daysAgo(3) },
    { id: "v_1_2", label: "V2", resumeId: "resume_1", resumeTitle: "Stripe", sourceType: "rewrite", score: 78, createdAt: daysAgo(8) },
    { id: "v_1_1", label: "V1", resumeId: "resume_1", resumeTitle: "Stripe", sourceType: "upload", score: 62, createdAt: daysAgo(20) },
    { id: "v_2_1", label: "V1", resumeId: "resume_2", resumeTitle: "Vercel", sourceType: "upload", score: 58, createdAt: daysAgo(34) },
    { id: "v_3_1", label: "V1", resumeId: "resume_3", resumeTitle: "Notion", sourceType: "upload", score: 71, createdAt: daysAgo(60) },
  ],
};

export const mockHistory = {
  totals: { all: 9, upload: 3, analyze: 3, rewrite: 3 },
  events: [
    { id: "ev1", type: "analyze", title: "Analyzed V3 of Stripe resume", subtitle: "ATS score 86 / 100", label: "Analysis", at: hoursAgo(2), resumeId: "resume_1" },
    { id: "ev2", type: "rewrite", title: "Applied 4 rewrites — created V3", subtitle: "Stripe resume", label: "Rewrite", at: minutesAgo(28), resumeId: "resume_1" },
    { id: "ev3", type: "analyze", title: "Analyzed V2 of Stripe resume", subtitle: "ATS score 78 / 100", label: "Analysis", at: daysAgo(8), resumeId: "resume_1" },
    { id: "ev4", type: "rewrite", title: "Applied 3 rewrites — created V2", subtitle: "Vercel resume", label: "Rewrite", at: daysAgo(3), resumeId: "resume_2" },
    { id: "ev5", type: "analyze", title: "Analyzed V2 of Vercel resume", subtitle: "ATS score 74 / 100", label: "Analysis", at: daysAgo(3), resumeId: "resume_2" },
    { id: "ev6", type: "upload", title: "Uploaded Stripe resume", subtitle: "Parsed 6 sections", label: "Upload", at: daysAgo(20), resumeId: "resume_1" },
    { id: "ev7", type: "upload", title: "Uploaded Vercel resume", subtitle: "Parsed 5 sections", label: "Upload", at: daysAgo(34), resumeId: "resume_2" },
    { id: "ev8", type: "rewrite", title: "Applied 5 rewrites — created V2", subtitle: "Stripe resume", label: "Rewrite", at: daysAgo(8), resumeId: "resume_1" },
    { id: "ev9", type: "upload", title: "Uploaded Notion resume", subtitle: "Parsed 4 sections", label: "Upload", at: daysAgo(60), resumeId: "resume_3" },
  ],
};
