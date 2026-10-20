process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:1/test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.GEMINI_API_KEY = "";

const parsed = {
  basics: { name: "Asha Rao", email: "asha@example.com", phone: "+91 9000000000", links: [{ label: "GitHub", url: "https://github.com/asha" }] },
  summary: "Computer science student who builds web apps.",
  skills: ["JavaScript", "Python", "MySQL", "Git"],
  skillGroups: [{ category: "Languages", items: ["JavaScript", "Python"] }, { category: "Databases", items: ["MySQL"] }],
  experience: [],
  projects: [
    { name: "ChronoGen", tech: ["Node.js", "Express.js"], bullets: ["Built a REST API with Express.js that generates conflict-free timetables.", "Implemented a Genetic Algorithm in JavaScript."], links: [] },
  ],
  education: [{ degree: "B.Tech in Computer Science and Engineering", school: "Graphic Era Hill University", period: "2025 - 2029", details: "CGPA 8.3" }],
  certifications: [],
};
const rawText = "Asha Rao\nSKILLS JavaScript Python MySQL Git\nChronoGen Built a REST API with Express.js that generates conflict-free timetables.";

const req = (o) => ({ id: "r1", type: "required", category: "skill", skill: "", text: "", sourceSentence: "", clarification: null, ...o });

module.exports = { parsed, rawText, req };
