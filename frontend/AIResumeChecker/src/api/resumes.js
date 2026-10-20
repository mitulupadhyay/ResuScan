import { apiClient } from "./client";

export const resumesApi = {
  list: () => apiClient.get("/resumes").then((r) => r.data),
  get: (id) => apiClient.get(`/resumes/${id}`).then((r) => r.data),
  getVersion: (id, versionId) =>
    apiClient.get(`/resumes/${id}/versions/${versionId}`).then((r) => r.data),
  upload: (file, title) => {
    const fd = new FormData();
    fd.append("file", file);
    if (title) fd.append("title", title);
    return apiClient
      .post("/resumes", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
<<<<<<< HEAD
  },
  remove: (id) => apiClient.delete(`/resumes/${id}`).then((r) => r.data),
  analyze: (id, body = {}) =>
    apiClient.post(`/resumes/${id}/analyze`, body).then((r) => r.data),
  analyses: (id) =>
    apiClient.get(`/resumes/${id}/analyses`).then((r) => r.data),
  analysisForVersion: (id, versionId) =>
    apiClient
      .get(`/resumes/${id}/versions/${versionId}/analysis`)
      .then((r) => r.data),
  rewrite: (id, body) =>
    apiClient.post(`/resumes/${id}/rewrite`, body).then((r) => r.data),
=======
  },
  remove: (id) => apiClient.delete(`/resumes/${id}`).then((r) => r.data),
  analyze: (id, body = {}) =>
    apiClient.post(`/resumes/${id}/analyze`, body).then((r) => r.data),
  analyses: (id) =>
    apiClient.get(`/resumes/${id}/analyses`).then((r) => r.data),
  analysisForVersion: (id, versionId) =>
    apiClient
      .get(`/resumes/${id}/versions/${versionId}/analysis`)
      .then((r) => r.data),
  rewrite: (id, body) =>
    apiClient.post(`/resumes/${id}/rewrite`, body).then((r) => r.data),
  createBlank: (title) =>
    apiClient.post("/resumes/blank", { title }).then((r) => r.data),
  validateExport: (id, versionId, blob) => {
    const fd = new FormData();
    fd.append("file", blob, "export.pdf");
    return apiClient
      .post(`/resumes/${id}/versions/${versionId}/validate-export`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
  saveSections: (id, versionId, sections) =>
    apiClient
      .put(`/resumes/${id}/versions/${versionId}/sections`, { sections })
      .then((r) => r.data),
  restore: (id, versionId) =>
    apiClient.post(`/resumes/${id}/versions/${versionId}/restore`).then((r) => r.data),
  optimize: (id, body = {}) =>
    apiClient.post(`/resumes/${id}/optimize`, body).then((r) => r.data),
  reparse: (id, versionId) =>
    apiClient
      .post(`/resumes/${id}/versions/${versionId}/reparse`)
      .then((r) => r.data),
>>>>>>> 12ed780 (feat: custom section order, security headers, frontend unit tests)
  diff: (id, from, to, mode = "words") =>
    apiClient
      .get(`/resumes/${id}/diff`, { params: { from, to, mode } })
      .then((r) => r.data),
};
