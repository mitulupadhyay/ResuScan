// Canonical skill names + aliases. Used by the JD parser and the matcher so
// "NodeJS", "node.js" and "Node" all mean the same thing.
const SKILLS = {
  javascript: ["javascript", "js", "ecmascript", "es6"],
  typescript: ["typescript", "ts"],
  python: ["python"],
  java: ["java"],
  "c++": ["c++", "cpp"],
  c: ["C"],
  "c#": ["c#", "csharp"],
  go: ["Go", "golang"],
  sql: ["sql"],
  html: ["html", "html5"],
  css: ["css", "css3"],
  "tailwind css": ["tailwind", "tailwind css", "tailwindcss"],
  react: ["react", "reactjs", "react.js"],
  "next.js": ["next.js", "nextjs"],
  vue: ["vue", "vuejs", "vue.js"],
  angular: ["angular", "angularjs"],
  redux: ["redux"],
  "node.js": ["node.js", "nodejs", "node"],
  "express.js": ["express.js", "expressjs", "express"],
  django: ["django"],
  flask: ["flask"],
  "spring boot": ["spring boot", "springboot", "spring"],
  mongodb: ["mongodb", "mongo"],
  mysql: ["mysql"],
  postgresql: ["postgresql", "postgres"],
  redis: ["redis"],
  firebase: ["firebase"],
  "rest api": ["rest api", "rest apis", "restful", "rest", "restful api", "restful apis"],
  graphql: ["graphql"],
  git: ["git"],
  github: ["github"],
  docker: ["docker"],
  kubernetes: ["kubernetes", "k8s"],
  aws: ["aws", "amazon web services"],
  azure: ["azure"],
  gcp: ["gcp", "google cloud"],
  linux: ["linux"],
  "ci/cd": ["ci/cd", "cicd", "continuous integration"],
  testing: ["unit testing", "jest", "mocha", "pytest", "junit", "testing"],
  "data structures": ["data structures", "dsa"],
  algorithms: ["algorithms", "algorithm"],
  oop: ["oop", "object-oriented", "object oriented"],
  dbms: ["dbms", "database management"],
  "operating systems": ["operating systems", "operating system"],
  "computer networks": ["computer networks", "networking"],
  "machine learning": ["machine learning", "ml"],
  pandas: ["pandas"],
  numpy: ["numpy"],
  tensorflow: ["tensorflow"],
  pytorch: ["pytorch"],
  "power bi": ["power bi", "powerbi"],
  tableau: ["tableau"],
  excel: ["excel"],
  figma: ["figma"],
  agile: ["agile", "scrum"],
  jwt: ["jwt"],
};

// Related (not equivalent) skills: weak hints only - they yield "needs review", never "matched".
const RELATED = {
  "node.js": ["express.js", "javascript"],
  "express.js": ["node.js"],
  react: ["javascript", "next.js", "redux"],
  "next.js": ["react"],
  typescript: ["javascript"],
  postgresql: ["sql", "mysql"],
  mysql: ["sql", "postgresql"],
  sql: ["mysql", "postgresql", "dbms"],
  mongodb: ["dbms"],
  "rest api": ["express.js", "node.js", "flask", "django"],
  "spring boot": ["java"],
  django: ["python", "flask"],
  flask: ["python", "django"],
  "machine learning": ["tensorflow", "pytorch", "pandas"],
};

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const caseSensitive = (a) => a === "C" || a === "Go";

const PATTERNS = Object.entries(SKILLS).map(([canonical, aliases]) => ({
  canonical,
  regexes: aliases.map(
    (a) =>
      new RegExp(
        `(?<![A-Za-z0-9+#])${esc(a)}(?![A-Za-z0-9+#])`,
        caseSensitive(a) ? "" : "i"
      )
  ),
}));

const BY_CANONICAL = Object.fromEntries(PATTERNS.map((p) => [p.canonical, p]));

/** Canonical skills mentioned in a piece of text. */
function findSkills(text) {
  const t = String(text || "");
  return PATTERNS.filter((p) => p.regexes.some((r) => r.test(t))).map((p) => p.canonical);
}

function textHasSkill(text, canonical) {
  const p = BY_CANONICAL[canonical];
  if (p) return p.regexes.some((r) => r.test(String(text || "")));
  return new RegExp(`(?<![A-Za-z0-9+#])${esc(canonical)}(?![A-Za-z0-9+#])`, "i").test(String(text || ""));
}

/** Map any alias/spelling to its canonical name; unknown skills are returned lower-cased. */
function canonicalize(name) {
  const n = String(name || "").trim();
  if (!n) return "";
  const hit = PATTERNS.find((p) => p.regexes.some((r) => new RegExp(`^${r.source}$`, r.flags).test(n)));
  return hit ? hit.canonical : n.toLowerCase();
}

module.exports = { findSkills, textHasSkill, canonicalize, RELATED };
