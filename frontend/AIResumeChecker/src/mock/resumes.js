// Mock resumes + per-version analyses for the boilerplate.
// Delete this file once the backend is connected.

import { daysAgo, hoursAgo } from "./_helpers";

function makeVersion({ id, label, score, sourceType, createdAt }) {
  return {
    _id: id,
    label,
    sourceType,
    createdAt,
    score,
    rawText: "—",
    parsedSections: {
      basics: {
        name: "Alex Carter",
        title: "Senior Frontend Engineer",
        email: "alex@timetoprogram.com",
        phone: "+1 (415) 555-0123",
        location: "San Francisco, CA",
        links: [
          { label: "github.com/alex", url: "#" },
          { label: "linkedin.com/in/alex", url: "#" },
        ],
      },
      summary:
        "Frontend engineer with 6+ years building production React apps at consumer-scale. Shipped 4 analytics dashboards adopted by 12k+ daily users.",
      experience: [
        {
          role: "Senior Frontend Engineer",
          company: "Acme Analytics",
          period: "2023 — Present",
          bullets: [
            "Shipped 4 React dashboards adopted by 12k+ daily users; cut TTI 38%.",
            "Led migration from Webpack to Vite — build times down from 92s to 11s.",
            "Owned the design-system rewrite (40+ components, full a11y pass).",
          ],
        },
        {
          role: "Frontend Engineer",
          company: "Northwind",
          period: "2020 — 2023",
          bullets: [
            "Built the customer-facing billing portal handling $4.2M/mo in transactions.",
            "Reduced p95 page load from 3.1s to 0.9s via code-split + image pipeline.",
          ],
        },
      ],
      education: [
        { degree: "B.S. Computer Science", school: "UC Berkeley", period: "2016 — 2020" },
      ],
      skills: [
        "React", "TypeScript", "Node.js", "GraphQL", "Tailwind",
        "Vite", "Jest", "Playwright", "AWS", "PostgreSQL",
      ],
      projects: [
        {
          name: "OSS Recharts plugin",
          tech: ["TypeScript", "Recharts"],
          summary: "Open-source plugin for animated stacked area charts. 1.2k★.",
        },
      ],
      certifications: [{ name: "AWS Solutions Architect — Associate", year: 2024 }],
      languages: ["English", "Spanish"],
      interests: ["Trail running", "Open source", "Photography"],
    },
  };
}

export const mockResumes = [
  {
    _id: "resume_1",
    title: "Senior Frontend Engineer — Stripe",
    createdAt: daysAgo(20),
    updatedAt: hoursAgo(2),
    currentVersionId: "v_1_3",
    bestScore: 86,
    versionCount: 3,
    versions: [
      makeVersion({ id: "v_1_1", label: "V1", score: 62, sourceType: "upload", createdAt: daysAgo(20) }),
      makeVersion({ id: "v_1_2", label: "V2", score: 78, sourceType: "rewrite", createdAt: daysAgo(8) }),
      makeVersion({ id: "v_1_3", label: "V3", score: 86, sourceType: "rewrite", createdAt: hoursAgo(2) }),
    ],
  },
  {
    _id: "resume_2",
    title: "Full-Stack Engineer — Vercel",
    createdAt: daysAgo(34),
    updatedAt: daysAgo(3),
    currentVersionId: "v_2_2",
    bestScore: 74,
    versionCount: 2,
    versions: [
      makeVersion({ id: "v_2_1", label: "V1", score: 58, sourceType: "upload", createdAt: daysAgo(34) }),
      makeVersion({ id: "v_2_2", label: "V2", score: 74, sourceType: "rewrite", createdAt: daysAgo(3) }),
    ],
  },
  {
    _id: "resume_3",
    title: "React Engineer — Notion",
    createdAt: daysAgo(60),
    updatedAt: daysAgo(40),
    currentVersionId: "v_3_1",
    bestScore: 71,
    versionCount: 1,
    versions: [
      makeVersion({ id: "v_3_1", label: "V1", score: 71, sourceType: "upload", createdAt: daysAgo(60) }),
    ],
  },
];

function makeAnalysis({ id, versionId, atsScore, summary }) {
  return {
    _id: id,
    versionId,
    atsScore,
    model: "gemini-2.5-flash",
    summary,
    scoreBreakdown: [
      { label: "Keywords", value: Math.min(100, atsScore + 4) },
      { label: "Format", value: Math.max(40, atsScore - 12) },
      { label: "Impact", value: Math.min(100, atsScore + 5) },
      { label: "Readability", value: Math.max(50, atsScore - 4) },
      { label: "Action verbs", value: Math.max(50, atsScore - 7) },
    ],
    issues: [
      { title: "Weak action verbs in Experience section", severity: "high", fix: "Swap 'helped', 'worked on', 'was responsible for' for strong verbs like 'shipped', 'led', 'cut'." },
      { title: "Missing keywords for target role", severity: "high", fix: "Add 'GraphQL' and 'Docker' — both appear in the JD but are missing from the resume." },
      { title: "Inconsistent date formatting", severity: "medium", fix: "Use one format throughout (e.g. 'Jan 2024 — Present')." },
      { title: "First bullet of latest role is too long", severity: "low", fix: "Cap each bullet at ~20 words. Break the first bullet into two." },
      { title: "Education section missing graduation year", severity: "low", fix: "Add a graduation year to the B.S. entry." },
    ],
    strengths: [
      { title: "Quantified outcomes in every senior-role bullet", note: "12k+ users, 38% TTI cut, 92s → 11s build." },
      { title: "Clean single-column layout", note: "Parses perfectly across ATS systems." },
      { title: "Strong action verbs in latest role", note: "shipped, led, owned — all impact verbs." },
      { title: "Domain-relevant skill stack", note: "React, TypeScript, Vite — matches JD." },
      { title: "Recent certification listed", note: "AWS SA-A signals up-to-date credentials." },
    ],
    keywordsPresent: ["React", "TypeScript", "Node.js", "Vite", "Jest", "Playwright", "AWS"],
    keywordsMissing: ["GraphQL", "Docker", "Kubernetes", "Redis"],
    bulletRewrites: [
      {
        _id: "rw_1",
        section: "experience",
        original: "Worked on dashboards for the analytics team.",
        rewritten: "Shipped 4 React analytics dashboards adopted by 12k+ daily users — cut load time 38%.",
        rationale: "Quantified outcome + strong verb + named the user-base scale.",
      },
      {
        _id: "rw_2",
        section: "experience",
        original: "Helped migrate the build system.",
        rewritten: "Led migration from Webpack to Vite, reducing build times from 92s to 11s across 14 packages.",
        rationale: "Named the technologies + concrete metric + scope.",
      },
      {
        _id: "rw_3",
        section: "experience",
        original: "Was responsible for the design system rewrite.",
        rewritten: "Owned design-system rewrite (40+ components, full WCAG AA pass) — adopted by 6 product teams.",
        rationale: "Ownership signal + accessibility detail + adoption proof.",
      },
      {
        _id: "rw_4",
        section: "summary",
        original: "Frontend engineer with several years of experience.",
        rewritten: "Frontend engineer with 6+ years shipping production React at consumer scale.",
        rationale: "Specific tenure + 'production' + scale signal.",
      },
    ],
  };
}

export const mockAnalyses = {
  v_1_1: makeAnalysis({ id: "an_1_1", versionId: "v_1_1", atsScore: 62, summary: "Solid foundation but weak verbs and missing keywords pull the score down. Applying the suggested rewrites should land V2 in the high-70s." }),
  v_1_2: makeAnalysis({ id: "an_1_2", versionId: "v_1_2", atsScore: 78, summary: "Big jump from V1 — verbs and metrics are landing. Only the keyword gap (GraphQL, Docker) is holding this back from Excellent tier." }),
  v_1_3: makeAnalysis({ id: "an_1_3", versionId: "v_1_3", atsScore: 86, summary: "Excellent tier. Layout parses cleanly, every senior-role bullet has a quantified outcome, and keyword coverage is now 90%+ of the JD." }),
  v_2_1: makeAnalysis({ id: "an_2_1", versionId: "v_2_1", atsScore: 58, summary: "Needs work — too many weak verbs, almost no metrics." }),
  v_2_2: makeAnalysis({ id: "an_2_2", versionId: "v_2_2", atsScore: 74, summary: "Strong rewrite pass — most bullets now quantified." }),
  v_3_1: makeAnalysis({ id: "an_3_1", versionId: "v_3_1", atsScore: 71, summary: "Decent first pass — biggest wins are in Format and Action Verbs." }),
};

export function findMockResume(id) {
  return mockResumes.find((r) => r._id === id);
}

export function listMockResumesShallow() {
  return mockResumes.map((r) => ({
    _id: r._id,
    title: r.title,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    versionCount: r.versionCount,
    bestScore: r.bestScore,
  }));
}
