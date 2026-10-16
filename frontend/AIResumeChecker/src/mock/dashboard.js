// Mock dashboard payload for the boilerplate.
// Delete this file once the backend is connected.

import { minutesAgo, daysAgo } from "./_helpers";

export const mockDashboard = {
  totals: { resumes: 3, rewrites: 9, analyses: 12 },
  latestResume: { _id: "resume_1", title: "Senior Frontend Engineer — Stripe" },
  scoreSeries: [
    { label: "V1", score: 62 },
    { label: "V2", score: 78 },
    { label: "V3", score: 86 },
  ],
  versionStack: [
    { id: "v_1_1", label: "V1", title: "Upload", score: 62 },
    { id: "v_1_2", label: "V2", title: "Rewrite pass", score: 78 },
    { id: "v_1_3", label: "V3", title: "Rewrite pass", score: 86 },
  ],
  kpi: {
    atsScore: {
      value: 86,
      delta: 18,
      spark: [{ v: 62 }, { v: 65 }, { v: 70 }, { v: 78 }, { v: 82 }, { v: 84 }, { v: 86 }],
    },
    versions: {
      value: 6,
      spark: [{ v: 1 }, { v: 2 }, { v: 3 }, { v: 4 }, { v: 5 }, { v: 5 }, { v: 6 }],
    },
    issuesIdentified: {
      value: 14,
      delta: -32,
      spark: [{ v: 20 }, { v: 18 }, { v: 16 }, { v: 14 }, { v: 12 }, { v: 14 }, { v: 14 }],
    },
    keywordsMatched: {
      value: 24,
      total: 26,
      delta: 12,
      spark: [{ v: 12 }, { v: 14 }, { v: 17 }, { v: 19 }, { v: 21 }, { v: 23 }, { v: 24 }],
    },
  },
  activity: [
    { id: "a1", type: "analyze", title: "Analysis complete on V3", subtitle: "ATS score 86 / 100", label: "+8 pts", at: minutesAgo(4), resumeId: "resume_1" },
    { id: "a2", type: "rewrite", title: "4 bullets rewritten", subtitle: "Applied to Experience section", label: "V3 created", at: minutesAgo(28), resumeId: "resume_1" },
    { id: "a3", type: "analyze", title: "Analysis complete on V2", subtitle: "ATS score 78 / 100", label: "+16 pts", at: daysAgo(8), resumeId: "resume_1" },
    { id: "a4", type: "upload", title: "Senior_Frontend_Stripe.pdf uploaded", subtitle: "Parsed 6 sections, 18 bullets", label: "V1", at: daysAgo(20), resumeId: "resume_1" },
    { id: "a5", type: "rewrite", title: "3 bullets rewritten", subtitle: "Vercel resume", label: "V2 created", at: daysAgo(3), resumeId: "resume_2" },
  ],
};
