# StudyPilot

StudyPilot is an AI-powered student productivity web app for:
- task management
- weekly planning
- AI assistant (Nexa)
- calendar support
- analytics
- schedule import from PDF

This repo is a monorepo:
- `frontend` → React + Vite + Tailwind
- `backend` → Node.js + Express + Supabase

---

## Features

- Email auth + Google SSO (Supabase-based flow)
- Task CRUD (priority, deadline, complete, edit)
- Weekly schedule board
- AI assistant with agent mode
- Planner + analytics
- PDF schedule import (Node extractor + DeepSeek)
- Google Calendar connect (OAuth)

---

## Tech Stack

- Frontend: React 18, Vite 5, Tailwind CSS
- Backend: Express 4
- Database/Auth: Supabase
- AI: DeepSeek API
- Calendar: Google Calendar API

---

## Project Structure

```text
studypilot/
  frontend/
  backend/
```

---

## Local Development

### 1) Backend

```bash
cd backend
npm install
npm run dev
```

Backend default: `http://localhost:5050`

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend default: `http://localhost:5173`

---

## Environment Variables

## Frontend (`frontend/.env`)

```env
VITE_API_BASE_URL=http://localhost:5050/api
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>

# Optional fallback:
VITE_API_URL=/api

# Optional:
VITE_FORCE_GUEST_LOGIN=false
```

## Backend (`backend/.env`)

Use `backend/.env.example` as reference.

```env
PORT=5050
JWT_SECRET=<strong-random-secret>

SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-or-secret-key>

DEEPSEEK_API_URL=https://api.deepseek.com/chat/completions
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_API_KEY=<deepseek-key>

GOOGLE_CLIENT_ID=<google-client-id>
GOOGLE_CLIENT_SECRET=<google-client-secret>
GOOGLE_REDIRECT_URI=http://localhost:5050/api/calendar/callback
FRONTEND_URL=http://localhost:5173
```

---

## Supabase Setup (Minimum)

1. Create Supabase project
2. Run SQL schema from:
   - `backend/supabase/schema.sql`
3. Create Storage bucket:
   - `schedule-pdfs` (private)
4. Configure Auth URL settings:
   - Site URL: your frontend URL
   - Redirect URLs: include your frontend URL(s)
5. Enable Google provider in Supabase Auth and set Google OAuth credentials

---

## Deploy (Current Recommended)

## Frontend on Vercel

- Root directory: `frontend`
- Build command: `npm run build`
- Output: `dist`

Set env:
- `VITE_API_BASE_URL=https://<backend-domain>/api`
- `VITE_SUPABASE_URL=...`
- `VITE_SUPABASE_ANON_KEY=...`

## Backend on Vercel

- Root directory: `backend`
- Uses serverless entry: `backend/api/index.js`
- Routing config: `backend/vercel.json`

Set backend env vars from section above.

Health check:
- `https://<backend-domain>/api/health`

Config debug endpoint:
- `https://<backend-domain>/api/health/auth-config`

---

## Common Issues

### 1) `401 Unauthorized` on `/api/tasks` etc.
- Check frontend is sending token
- Verify `VITE_API_BASE_URL` points to correct backend
- Verify backend env is complete (`/api/health/auth-config`)

### 2) Google login returns to home/login
- Check Supabase URL config + redirect URLs
- Check Google redirect URI:
  - `https://<project-ref>.supabase.co/auth/v1/callback`
- Redeploy frontend after env changes

### 3) `Cannot GET /api`
- Normal if no `/api` root route
- Test with `/api/health` instead

### 4) PDF import errors on deploy
- Ensure `DEEPSEEK_API_KEY` exists
- Ensure backend has `pdf-parse` installed (already in dependencies)

---

## Scripts

## Backend
- `npm run dev`
- `npm start`
- `npm run seed:supabase`

## Frontend
- `npm run dev`
- `npm run build`
- `npm run preview`

---

## License

For academic/project use. Add your preferred license if needed.
