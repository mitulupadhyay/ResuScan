/** True when a parsed resume has no real content (e.g. it was parsed while the AI was unavailable). */
export function isThinParse(s) {
  if (!s) return true;
  return !(
    s.summary?.trim() ||
    s.experience?.length ||
    s.education?.length ||
    s.projects?.length ||
    s.skills?.length ||
    s.skillGroups?.length
  );
}
