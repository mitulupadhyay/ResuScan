// ─────────────────────────────────────────────────────────────────────────────
// API CLIENT — Axios instance.
// Disabled in the boilerplate (no backend yet). Uncomment when the backend
// is connected, and delete the `apiClient = null` placeholder below.
// ─────────────────────────────────────────────────────────────────────────────

// import axios from "axios";

// export const apiClient = axios.create({
//   baseURL: "/api",
//   withCredentials: true,
//   headers: { "Content-Type": "application/json" },
// });

// apiClient.interceptors.response.use(
//   (res) => res,
//   (err) => {
//     const message =
//       err.response?.data?.error?.message ||
//       err.message ||
//       "Request failed";
//     return Promise.reject({
//       status: err.response?.status,
//       message,
//       details: err.response?.data?.error?.details,
//       original: err,
//     });
//   }
// );

// Placeholder so existing imports from "./client" don't break while mocked.
export const apiClient = null;
