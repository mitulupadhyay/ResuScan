import { apiClient } from "./client";

export const jobMatchApi = {
  create: (body) => apiClient.post("/job-matches", body).then((r) => r.data),
  list: (resumeId) =>
    apiClient.get("/job-matches", { params: { resumeId } }).then((r) => r.data),
  get: (id) => apiClient.get(`/job-matches/${id}`).then((r) => r.data),
  patchRequirement: (id, reqId, body) =>
    apiClient.patch(`/job-matches/${id}/requirements/${reqId}`, body).then((r) => r.data),
  remove: (id) => apiClient.delete(`/job-matches/${id}`).then((r) => r.data),
};
