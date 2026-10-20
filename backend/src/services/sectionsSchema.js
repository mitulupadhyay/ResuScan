const { z } = require("zod");
const { SECTION_KEYS } = require("./resumeText");

const str = (max) => z.string().trim().max(max).default("");
const list = (max, itemMax) =>
  z.array(z.string().trim().max(itemMax)).max(max).default([]).transform((a) => a.filter(Boolean));

const url = z
  .string()
  .trim()
  .max(300)
  .default("")
  .transform((u) => (u && !/^[a-z][a-z0-9+.-]*:/i.test(u) ? `https://${u}` : u)) // bare domains get https://; explicit schemes are checked below
  .refine((u) => !u || /^(https?:\/\/|mailto:)\S+$/i.test(u), "Invalid link");
const link = z.object({ label: str(60), url });
const links = z.array(link).max(12).default([]).transform((a) => a.filter((l) => l.label || l.url));

const sectionsSchema = z.object({
  basics: z.object({
    name: z.string().trim().min(1, "Name is required").max(100),
    title: str(120),
    email: z.string().trim().max(120).default("").refine((e) => !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e), "Invalid email address"),
    phone: str(40),
    location: str(100),
    links,
  }),
  summary: str(1200),
  skillGroups: z.array(z.object({ category: str(60), items: list(60, 60) })).max(12).default([]),
  skills: list(120, 60),
  experience: z.array(z.object({ company: str(120), role: str(120), location: str(100), period: str(80), bullets: list(10, 400) })).max(15).default([]),
  education: z.array(z.object({ school: str(160), degree: str(160), location: str(100), period: str(80), details: str(300) })).max(6).default([]),
  projects: z.array(z.object({ name: str(160), tech: list(30, 50), bullets: list(8, 400), description: str(800), links })).max(15).default([]),
  certifications: z.array(z.object({ name: str(160), issuer: str(120), year: str(20) })).max(20).default([]),
  languages: list(20, 50),
  interests: list(20, 50),
  sectionOrder: z.array(z.enum(SECTION_KEYS)).max(SECTION_KEYS.length).default([]),
});

const hasContent = (o) => Object.values(o).some((v) => (Array.isArray(v) ? v.length : String(v).trim()));

/** Validate + normalize user-edited sections into the stored shape (fixed key order, no empty entries). */
function normalizeSections(input) {
  const s = sectionsSchema.parse(input);
  const groups = s.skillGroups.filter((g) => g.items.length);
  const flat = [...new Set([...groups.flatMap((g) => g.items), ...(groups.length ? [] : s.skills)])];
  return {
    basics: s.basics,
    summary: s.summary,
    skills: flat,
    skillGroups: groups.map((g) => ({ category: g.category || "Skills", items: g.items })),
    experience: s.experience.filter(hasContent),
    education: s.education.filter(hasContent),
    projects: s.projects.filter(hasContent),
    certifications: s.certifications.filter(hasContent),
    languages: s.languages,
    interests: s.interests,
    sectionOrder: [...new Set(s.sectionOrder)],
  };
}

module.exports = { sectionsSchema, normalizeSections };
