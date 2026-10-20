# ResuScan
AI-powered resume analyzer with explainable ATS scoring, AI-powered rewrites, and resume version history. MERN stack (Express 5 + MongoDB + React/Vite) with Gemini for analysis.

## Run locally (two terminals)

**1. Backend** (http://localhost:5000)
```bash
cd backend
cp .env.example .env      # Windows: copy .env.example .env  -> then fill in MONGO_URI, JWT_SECRET, GEMINI_API_KEY
npm install
npm run dev
```
Check it: http://localhost:5000/api/health should return `{"status":"ok","db":"connected",...}`.

**2. Frontend** (http://localhost:5173)
```bash
cd frontend/AIResumeChecker
npm install
npm run dev
```
Vite proxies `/api` to the backend, so no frontend env is needed locally.

## Production
- Backend: set `NODE_ENV=production`, a strong `JWT_SECRET`, `CLIENT_ORIGIN=<your frontend URL>`, then `npm start`.
- Frontend: set `VITE_API_URL=<backend URL>/api`, run `npm run build`, and serve `dist/` from any static host.
- Cookies are `SameSite=None; Secure` in production, so both sites must be served over HTTPS.
- Never commit `.env`. It is gitignored.
<<<<<<< HEAD
=======

## Job-description matching (Slice 1)
`POST /api/job-matches` takes a resume + pasted job description, extracts required/preferred/responsibility requirements (Gemini, with a built-in parser fallback), and matches them against your resume text with **no LLM in the matching or scoring step**. Scoring formula, weights and limitations: `backend/src/services/scoring.js`. Run tests: `cd backend && npm test`.

## Review/edit sections and restore versions (Slice 2)
`PUT /api/resumes/:id/versions/:versionId/sections` saves corrected sections as a **new** version (`sourceType: "edit"`); `POST .../restore` copies an old version forward as the newest (`"restore"`). Neither ever modifies or deletes an existing version. UI: **Edit sections** and **Restore this version** on the resume page.

## Evidence-aware bullet improvement (Slice 3)
`/api/improvements/{assess,generate,apply}`. The student supplies facts (contribution, technologies, details, ...); vague input gets follow-up questions instead of generation. Every suggested **and every user-edited** bullet is checked against those facts - invented numbers, technologies, leadership/scale/impact claims are rejected. Accepted bullets are saved as a new version; nothing is overwritten. The checker prevents invention; it cannot verify that the student's own claims are true.

## Onboarding, start-from-scratch, export verification (Slice 4)
- `PUT /api/auth/onboarding` stores target role, level, goal and an optional job description on the user (editable any time at `/onboarding`). The saved role pre-fills analysis; the saved JD pre-fills job matching.
- `POST /api/resumes/blank` creates an empty editable resume - no upload needed.
- `POST /api/resumes/:id/versions/:versionId/validate-export` re-extracts text from the generated PDF and compares it with the saved content (headings/order, content preserved, links, bullets, contact info). Nothing is stored. It checks readability and completeness, not any specific ATS.
- Uploads are checked for real `%PDF-` content; scanned/image-only PDFs get an explicit "OCR not supported" message.

## Uploads, data retention, evaluation (Slice 5)
- **Uploads:** PDF or Word (.docx), max 5 MB, verified by file signature, rate-limited (8/min/user). Hyperlink URLs are preserved from both formats. Scanned/image-only files are rejected with an explicit "OCR not supported" message. New dependency: `mammoth`.
- **Retention:** deleting a resume deletes all its versions, analyses and job matches. `DELETE /api/auth/account` (password required) deletes the account and everything it owns. Nothing is kept by the app; database backups are whatever your MongoDB host retains. Resume text is never written to server logs.
- **Evaluation:** `backend/test/eval/` holds 3 resumes, 3 job postings and 37 hand-written expected statuses. Last run: 35/37 agree. The two known misses are lexical-matching limits (a requirement worded differently from the resume, and "machine learning" implied by a regression model without the phrase). Labels were written by one person (the author), before looking at output, so this is a regression check, not independent validation. Matching is word-based, not semantic.
- **Matching rule (changed after evaluation):** a *related* skill (e.g. JavaScript for React) is not evidence; it is mentioned in the explanation but earns no score credit.

## Section order, security headers, tests (Slice 6)
- Section order: set per version in **Edit sections**; the PDF, plain-text version and export check all follow it (automatic order if unset). Contact details stay at the top.
- Security: `helmet` headers on every response; CORS limited to `CLIENT_ORIGIN`.
- Tests: `cd backend && npm test` (85 tests, uses the real server.js with the DB stubbed) and `cd frontend/AIResumeChecker && npm test` (6 tests for the form/ordering logic, no extra dependencies). There are still no browser/component tests.
>>>>>>> 12ed780 (feat: custom section order, security headers, frontend unit tests)
