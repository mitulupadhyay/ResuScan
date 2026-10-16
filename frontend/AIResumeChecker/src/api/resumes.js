// ─────────────────────────────────────────────────────────────────────────────
// RESUMES API — backed by mocks while the backend is offline.
// TO ENABLE THE REAL BACKEND:
//   1. Uncomment each `apiClient.*` line below.
//   2. Delete the mock implementation block underneath.
//   3. Delete the `import` from "@/mock/*".
// ─────────────────────────────────────────────────────────────────────────────

// import { apiClient } from "./client";
import {
  mockResumes,
  mockAnalyses,
  findMockResume,
  listMockResumesShallow,
} from "@/mock/resumes";
import { mockDelay } from "@/mock/_helpers";

export const resumesApi = {
  // list: () => apiClient.get("/resumes").then((r) => r.data),
  list: async () => {
    await mockDelay();
    return { resumes: listMockResumesShallow() };
  },

  // get: (id) => apiClient.get(`/resumes/${id}`).then((r) => r.data),
  get: async (id) => {
    await mockDelay();
    const resume = findMockResume(id);
    if (!resume) throw { status: 404, message: "Resume not found" };
    return {
      resume: {
        _id: resume._id,
        title: resume.title,
        createdAt: resume.createdAt,
        updatedAt: resume.updatedAt,
        currentVersionId: resume.currentVersionId,
      },
      versions: resume.versions,
    };
  },

  // getVersion: (id, versionId) =>
  //   apiClient.get(`/resumes/${id}/versions/${versionId}`).then((r) => r.data),
  getVersion: async (id, versionId) => {
    await mockDelay();
    const resume = findMockResume(id);
    const version = resume?.versions.find((v) => v._id === versionId);
    if (!version) throw { status: 404, message: "Version not found" };
    return { version };
  },

  // upload: (file, title) => {
  //   const fd = new FormData();
  //   fd.append("file", file);
  //   if (title) fd.append("title", title);
  //   return apiClient
  //     .post("/resumes", fd, { headers: { "Content-Type": "multipart/form-data" } })
  //     .then((r) => r.data);
  // },
  upload: async (file, title) => {
    await mockDelay(800);
    // Returns the most-recent mock resume so the UI navigates to a real detail page.
    const resume = mockResumes[0];
    return {
      resume: { ...resume, title: title || file?.name || resume.title },
    };
  },

  // remove: (id) => apiClient.delete(`/resumes/${id}`).then((r) => r.data),
  remove: async () => {
    await mockDelay();
    return { ok: true };
  },

  // analyze: (id, body = {}) =>
  //   apiClient.post(`/resumes/${id}/analyze`, body).then((r) => r.data),
  analyze: async (_id, { versionId } = {}) => {
    await mockDelay(1200);
    const analysis =
      mockAnalyses[versionId] || mockAnalyses[Object.keys(mockAnalyses)[0]];
    return { analysis };
  },

  // analyses: (id) => apiClient.get(`/resumes/${id}/analyses`).then((r) => r.data),
  analyses: async (id) => {
    await mockDelay();
    const resume = findMockResume(id);
    const analyses = (resume?.versions || [])
      .map((v) => mockAnalyses[v._id])
      .filter(Boolean);
    return { analyses };
  },

  // analysisForVersion: (id, versionId) =>
  //   apiClient.get(`/resumes/${id}/versions/${versionId}/analysis`).then((r) => r.data),
  analysisForVersion: async (_id, versionId) => {
    await mockDelay();
    const analysis = mockAnalyses[versionId];
    if (!analysis) throw { status: 404, message: "No analysis for this version" };
    return { analysis };
  },

  // rewrite: (id, body) =>
  //   apiClient.post(`/resumes/${id}/rewrite`, body).then((r) => r.data),
  rewrite: async (id, { rewriteIds = [] } = {}) => {
    await mockDelay(900);
    const resume = findMockResume(id);
    // Return the latest version as if it was the newly created one.
    const latest = resume?.versions[resume.versions.length - 1];
    return {
      version: latest,
      appliedCount: rewriteIds.length || 4,
    };
  },

  // diff: (id, from, to, mode = "words") =>
  //   apiClient.get(`/resumes/${id}/diff`, { params: { from, to, mode } }).then((r) => r.data),
  diff: async () => {
    await mockDelay();
    return {
      hunks: [
        { type: "remove", text: "Worked on dashboards for the analytics team." },
        { type: "add", text: "Shipped 4 React analytics dashboards adopted by 12k+ daily users — cut load time 38%." },
        { type: "context", text: "Led migration from Webpack to Vite — build times down from 92s to 11s." },
        { type: "remove", text: "Helped migrate the build system." },
        { type: "add", text: "Owned design-system rewrite (40+ components, full WCAG AA pass)." },
      ],
    };
  },
};
