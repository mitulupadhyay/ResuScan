// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD API — backed by mocks while the backend is offline.
// TO ENABLE THE REAL BACKEND:
//   1. Uncomment the `apiClient.get(...)` line below.
//   2. Delete the mock implementation block underneath.
//   3. Delete the `import` from "@/mock/*".
// ─────────────────────────────────────────────────────────────────────────────

// import { apiClient } from "./client";
import { mockDashboard } from "@/mock/dashboard";
import { mockDelay } from "@/mock/_helpers";

export const dashboardApi = {
  // get: () => apiClient.get("/dashboard").then((r) => r.data),
  get: async () => {
    await mockDelay();
    return mockDashboard;
  },
};
