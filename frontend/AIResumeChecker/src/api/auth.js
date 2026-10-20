import { apiClient } from "./client";

export const authApi = {
  register: (payload) =>
    apiClient.post("/auth/register", payload).then((r) => r.data),
  login: (payload) =>
    apiClient.post("/auth/login", payload).then((r) => r.data),
  logout: () => apiClient.post("/auth/logout").then((r) => r.data),
  me: () => apiClient.get("/auth/me").then((r) => r.data),
  updateProfile: (payload) =>
    apiClient.patch("/auth/profile", payload).then((r) => r.data),
<<<<<<< HEAD
=======
  saveOnboarding: (payload) =>
    apiClient.put("/auth/onboarding", payload).then((r) => r.data),
  deleteAccount: (password) =>
    apiClient.delete("/auth/account", { data: { password } }).then((r) => r.data),
>>>>>>> 12ed780 (feat: custom section order, security headers, frontend unit tests)
  changePassword: (payload) =>
    apiClient.patch("/auth/password", payload).then((r) => r.data),
};
