// Convert between the stored parsedSections shape and the flat strings the editor form uses.
const lines = (a) => (a || []).join("\n");
const fromLines = (s) => String(s || "").split("\n").map((x) => x.trim()).filter(Boolean);
const csv = (a) => (a || []).join(", ");
const fromCsv = (s) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);
const links = (a) => (a || []).map((l) => ({ label: l.label || "", url: l.url || "" }));

export function toForm(p = {}) {
  const b = p.basics || {};
  return {
    basics: { name: b.name || "", title: b.title || "", email: b.email || "", phone: b.phone || "", location: b.location || "", links: links(b.links) },
    summary: p.summary || "",
    skillGroups: p.skillGroups?.length
      ? p.skillGroups.map((g) => ({ category: g.category || "", items: csv(g.items) }))
      : p.skills?.length ? [{ category: "Technical Skills", items: csv(p.skills) }] : [],
    experience: (p.experience || []).map((e) => ({ company: e.company || "", role: e.role || "", location: e.location || "", period: e.period || "", bullets: lines(e.bullets) })),
    education: (p.education || []).map((e) => ({ school: e.school || "", degree: e.degree || "", location: e.location || "", period: e.period || "", details: e.details || "" })),
    projects: (p.projects || []).map((x) => ({ name: x.name || "", tech: csv(x.tech), bullets: lines(x.bullets?.length ? x.bullets : x.description ? [x.description] : []), links: links(x.links) })),
    certifications: (p.certifications || []).map((c) => ({ name: c.name || "", issuer: c.issuer || "", year: c.year || "" })),
    languages: csv(p.languages),
    interests: csv(p.interests),
    sectionOrder: p.sectionOrder || [],
  };
}

export function toPayload(f) {
  return {
    basics: f.basics,
    summary: f.summary,
    skillGroups: f.skillGroups.map((g) => ({ category: g.category, items: fromCsv(g.items) })),
    experience: f.experience.map((e) => ({ ...e, bullets: fromLines(e.bullets) })),
    education: f.education,
    projects: f.projects.map((x) => ({ name: x.name, tech: fromCsv(x.tech), bullets: fromLines(x.bullets), links: x.links })),
    certifications: f.certifications,
    languages: fromCsv(f.languages),
    interests: fromCsv(f.interests),
    sectionOrder: f.sectionOrder || [],
  };
}

export function validateForm(f) {
  if (!f.basics.name.trim()) return "Name is required.";
  if (f.basics.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.basics.email.trim())) return "Email address looks invalid.";
  return "";
}
