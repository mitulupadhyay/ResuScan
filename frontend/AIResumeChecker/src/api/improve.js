import { apiClient } from "./client";

export const improveApi = {
  assess: (body) => apiClient.post("/improvements/assess", body).then((r) => r.data),
  generate: (body) => apiClient.post("/improvements/generate", body).then((r) => r.data),
  apply: (body) => apiClient.post("/improvements/apply", body).then((r) => r.data),
};
