// Small hand-labeled evaluation set. Labels were written by the author from the status definitions
// (Matched = used in a project/job; Partial = only listed; Needs review = ambiguous; Not evidenced = absent),
// BEFORE looking at matcher output. Arrays mean "either is acceptable". This is a regression/sanity check,
// not independent validation: 3 resumes, 3 postings, one labeler.

const resumes = {
  web: {
    basics: { name: "Asha Rao", email: "asha@example.com", phone: "+91 9000000000", links: [{ label: "GitHub", url: "https://github.com/asha" }] },
    skills: ["C++", "JavaScript", "C", "HTML5", "CSS3", "Tailwind CSS", "Node.js", "Express.js", "MySQL", "Git"],
    projects: [
      { name: "ChronoGen", tech: ["JavaScript", "Node.js", "Express.js", "MySQL"], bullets: ["Built a REST API with Express.js that generates conflict-free timetables.", "Implemented a genetic algorithm in JavaScript to satisfy room and faculty constraints."] },
      { name: "CampusConnect", tech: ["HTML", "Tailwind CSS", "JavaScript"], bullets: ["Designed a responsive frontend for a campus event and club discovery platform."] },
    ],
    education: [{ degree: "B.Tech in Computer Science and Engineering", school: "Graphic Era Hill University", period: "2025 - 2029" }],
  },
  data: {
    basics: { name: "Ravi Menon", email: "ravi@example.com", phone: "+91 9111111111", links: [] },
    skills: ["Python", "SQL", "pandas", "NumPy", "Excel", "Power BI"],
    projects: [
      { name: "Sales Forecasting", tech: ["Python", "pandas", "scikit-learn"], bullets: ["Cleaned and analysed three years of retail sales data with pandas.", "Built a linear regression model to forecast monthly demand."] },
      { name: "Attendance Dashboard", tech: ["Power BI"], bullets: ["Designed a Power BI dashboard that visualises attendance trends by department."] },
    ],
    education: [{ degree: "B.Sc in Computer Science", school: "City College", period: "2023 - 2026" }],
  },
  backend: {
    basics: { name: "Meera Iyer", email: "meera@example.com", phone: "+91 9222222222", links: [] },
    skills: ["Java", "Spring Boot", "MySQL", "Docker", "Git", "REST APIs"],
    experience: [{ company: "Acme Pay", role: "Backend Intern", period: "Jun 2025 - Aug 2025", bullets: ["Developed REST APIs in Java with Spring Boot to expose payment status.", "Wrote MySQL queries and schema migrations for the transactions service.", "Containerised the service with Docker for local and staging use."] }],
    projects: [],
    education: [{ degree: "B.Tech in Computer Science and Engineering", school: "NIT Example", period: "2022 - 2026" }],
  },
};

const jds = {
  frontend: `Frontend Developer Intern

About the role
We build learning tools used by thousands of students.

Responsibilities
- Build responsive user interfaces with modern frameworks
- Collaborate with designers and backend engineers

Requirements
- Pursuing a Bachelor's degree in Computer Science or a related field
- Solid knowledge of JavaScript, HTML and CSS
- Experience with React
- Familiarity with REST APIs and Git

Nice to have
- TypeScript
- Docker`,
  data: `Data Analyst Intern

Requirements
- Proficiency in Python and SQL
- Experience with pandas for data cleaning
- Working knowledge of Excel and Power BI

Preferred
- Tableau
- Machine learning exposure`,
  backend: `Backend Developer

Requirements
- Strong knowledge of Java and Spring Boot
- Experience with MySQL or PostgreSQL
- Building REST APIs
- Docker and Git
- 2+ years of professional software experience

Preferred
- AWS
- Kubernetes`,
};

// [resume, jd, requirement (skill name or text fragment), expected status or list of acceptable statuses]
const labels = [
  ["web", "frontend", "javascript", "matched"],
  ["web", "frontend", "html", "matched"],
  ["web", "frontend", "css", "matched"],
  ["web", "frontend", "rest api", "matched"],
  ["web", "frontend", "git", "partial"],
  ["web", "frontend", "react", "not_evidenced"],
  ["web", "frontend", "typescript", "not_evidenced"],
  ["web", "frontend", "docker", "not_evidenced"],
  ["web", "frontend", "Bachelor", "matched"],
  ["web", "frontend", "Build responsive user interfaces", ["partial", "needs_review"], "known-limitation"], // lexical overlap only; no semantic matching
  ["web", "frontend", "Collaborate with designers", ["not_evidenced", "needs_review"]],

  ["data", "data", "python", "matched"],
  ["data", "data", "pandas", "matched"],
  ["data", "data", "power bi", "matched"],
  ["data", "data", "sql", "partial"],
  ["data", "data", "excel", "partial"],
  ["data", "data", "tableau", "not_evidenced"],
  ["data", "data", "machine learning", ["partial", "needs_review"], "known-limitation"], // implicit evidence (regression model, scikit-learn) without the phrase

  ["backend", "backend", "java", "matched"],
  ["backend", "backend", "spring boot", "matched"],
  ["backend", "backend", "mysql", "matched"],
  ["backend", "backend", "rest api", "matched"],
  ["backend", "backend", "docker", "matched"],
  ["backend", "backend", "git", "partial"],
  ["backend", "backend", "postgresql", ["not_evidenced", "needs_review"]],
  ["backend", "backend", "2+ years", "needs_review"],
  ["backend", "backend", "aws", "not_evidenced"],
  ["backend", "backend", "kubernetes", "not_evidenced"],

  // cross-checks: wrong resume for the posting must not look like a match
  ["data", "backend", "java", "not_evidenced"],
  ["data", "backend", "spring boot", "not_evidenced"],
  ["data", "backend", "docker", "not_evidenced"],
  ["data", "backend", "rest api", "not_evidenced"],
  ["data", "backend", "mysql", ["not_evidenced", "needs_review"]],
  ["backend", "frontend", "javascript", "not_evidenced"],
  ["backend", "frontend", "react", "not_evidenced"],
  ["backend", "frontend", "rest api", "matched"],
  ["backend", "frontend", "Bachelor", "matched"],
];

module.exports = { resumes, jds, labels };
