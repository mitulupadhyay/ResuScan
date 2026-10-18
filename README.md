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
