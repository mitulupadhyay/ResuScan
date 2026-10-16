// Mock user + localStorage-backed session for the boilerplate auth flow.
// Delete this file once the backend is connected.

import { daysAgo } from "./_helpers";

export const mockUser = {
  _id: "user_1",
  name: "Alex Carter",
  email: "alex@timetoprogram.com",
  createdAt: daysAgo(45),
};

const STORAGE_KEY = "arr-mock-user";

export function loadMockUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveMockUser(u) {
  if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  else localStorage.removeItem(STORAGE_KEY);
}
