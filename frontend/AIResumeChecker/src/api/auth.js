// ─────────────────────────────────────────────────────────────────────────────
// AUTH API — backed by mocks while the backend is offline.
// TO ENABLE THE REAL BACKEND:
//   1. Uncomment each `apiClient.*` line below.
//   2. Delete the mock implementation block underneath.
//   3. Delete the `import` from "@/mock/auth" + "@/mock/_helpers".
// ─────────────────────────────────────────────────────────────────────────────

// import { apiClient } from "./client";
import { mockUser, loadMockUser, saveMockUser } from "@/mock/auth";
import { mockDelay } from "@/mock/_helpers";

export const authApi = {
  // register: (payload) => apiClient.post("/auth/register", payload).then((r) => r.data),
  register: async ({ name, email }) => {
    await mockDelay();
    const u = { ...mockUser, name: name || mockUser.name, email: email || mockUser.email };
    saveMockUser(u);
    return { user: u };
  },

  // login: (payload) => apiClient.post("/auth/login", payload).then((r) => r.data),
  login: async ({ email }) => {
    await mockDelay();
    const u = { ...mockUser, email: email || mockUser.email };
    saveMockUser(u);
    return { user: u };
  },

  // logout: () => apiClient.post("/auth/logout").then((r) => r.data),
  logout: async () => {
    await mockDelay(150);
    saveMockUser(null);
    return { ok: true };
  },

  // me: () => apiClient.get("/auth/me").then((r) => r.data),
  me: async () => {
    await mockDelay(150);
    const u = loadMockUser();
    if (!u) {
      // mimic the 401 the real backend would throw → AuthContext shows /login
      throw { status: 401, message: "Not authenticated" };
    }
    return { user: u };
  },

  // updateProfile: (payload) => apiClient.patch("/auth/profile", payload).then((r) => r.data),
  updateProfile: async (payload) => {
    await mockDelay();
    const current = loadMockUser() || mockUser;
    const u = { ...current, ...payload };
    saveMockUser(u);
    return { user: u };
  },

  // changePassword: (payload) => apiClient.patch("/auth/password", payload).then((r) => r.data),
  changePassword: async () => {
    await mockDelay();
    return { ok: true };
  },
};
