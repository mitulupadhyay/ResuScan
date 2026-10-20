// Which resume sections to render, and in what order. Keep in sync with backend/src/services/resumeText.js (resolveOrder).
export const SECTION_KEYS = ["summary", "skills", "experience", "projects", "education", "certifications", "additional"];
export const SECTION_TITLES = {
  summary: "Professional Summary",
  skills: "Technical Skills",
  experience: "Experience",
  projects: "Projects",
  education: "Education",
  certifications: "Certifications",
  additional: "Additional Information",
};

export function sectionContent(p = {}) {
  return {
    summary: !!p.summary?.trim(),
    skills: (p.skillGroups || []).length > 0 || (p.skills || []).length > 0,
    experience: (p.experience || []).length > 0,
    projects: (p.projects || []).length > 0,
    education: (p.education || []).length > 0,
    certifications: (p.certifications || []).some((c) => c.name),
    additional: (p.languages || []).length > 0 || (p.interests || []).length > 0,
  };
}

/** A saved sectionOrder wins; sections it omits are appended in the default order. Empty sections are skipped. */
export function resolveOrder(p = {}) {
  const has = sectionContent(p);
  const fallback = has.experience
    ? ["summary", "skills", "experience", "projects", "education", "certifications", "additional"]
    : ["summary", "education", "skills", "projects", "certifications", "additional"];
  const chosen = (p.sectionOrder || []).filter((k) => SECTION_KEYS.includes(k));
  return [...new Set([...chosen, ...fallback])].filter((k) => has[k]);
}
