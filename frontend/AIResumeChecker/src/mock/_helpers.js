// Shared helpers for boilerplate mock data.
// Delete this entire `src/mock/` folder once the backend is connected.

export const minutesAgo = (m) => new Date(Date.now() - m * 60 * 1000).toISOString();
export const hoursAgo = (h) => minutesAgo(h * 60);
export const daysAgo = (d) => hoursAgo(d * 24);

export const mockDelay = (ms = 450) =>
  new Promise((resolve) => setTimeout(resolve, ms));
