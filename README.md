# Laras / FIT

Personal fitness and nutrition journal built with React + TypeScript + Vite, Supabase, and Recharts.

## Features
- Date-specific daily logs (`YYYY-MM-DD`) and month calendar.
- Shift, workout start time, exercise checklist and per-exercise load.
- Nutrition log for calories, protein, carbohydrates, and fats.
- Automatic post-workout meal time set to **60 minutes after the entered workout start time**; can be edited manually.
- Steps, stomach-vacuum rounds, water, notes, body weight field in the data model.
- Weekly charts for calories, protein, steps, completed sessions, and recorded load.
- Local browser persistence as a fallback; JSON export for backup.
- Supabase email magic-link authentication and row-level security.
- GitHub Actions build check.

## Requirements
- Node.js 20+
- A Supabase project for cross-device cloud persistence (optional for local-only use).

## Run locally
```bash
npm install
cp .env.example .env
# Add your Supabase project URL and anon key to .env (optional for local-only mode)
npm run dev
```
Open the URL printed by Vite.

## Enable Supabase
1. Create a project in Supabase.
2. In **SQL Editor**, run `supabase/schema.sql`.
3. Copy `.env.example` to `.env`.
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. In Supabase Auth settings, configure the site's URL and allowed redirect URL for local development and production.
6. Restart the Vite server.
7. Open **Akun & sinkronisasi**, enter your email, and follow the sign-in link.
8. Save each day's log to the database. Existing local logs remain available in the current browser; cloud sync loads cloud rows after login.

**Security:** only use the Supabase anon/public key in frontend env. Never put a Supabase `service_role` key in browser code or commit secrets to GitHub. Row-level security limits each authenticated user to their own logs.

## GitHub setup
1. Create a new repository on GitHub, for example `laras-fit`.
2. Extract this ZIP and push the project:
```bash
git init
git add .
git commit -m "Initial Laras FIT app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/laras-fit.git
git push -u origin main
```
3. The GitHub Actions workflow in `.github/workflows/ci.yml` runs a production build on pushes and pull requests.

## Deployment
Deploy the repository to Vercel or Netlify as a Vite application:
- Build command: `npm run build`
- Output directory: `dist`
- Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as deployment environment variables.
- Add the deployed URL to Supabase Auth redirect URL allowlist.

## Notes / current scope
- Local browser data is device/browser-specific. Cloud sync is available after Supabase configuration and login.
- The current database stores each day's structured log in a JSONB payload keyed by unique `(user_id, log_date)`. This prevents one Monday's log from overwriting another Monday in a different week.
- Post-workout meal scheduling is currently based on workout **start time + 60 minutes**, as a first implementation. If you'd rather have meal timing calculated from workout end time and an entered workout duration, extend the form with workout duration and use `end time + 0–60 minutes`.
- Weekly charts use the selected date's Monday–Sunday week.
- `weightKg` is reserved in the log model for body-weight progression; the current UI can be extended with a dedicated body-weight input/chart in the next iteration.
- This is a starter app, not yet independently production-audited. Review data handling and test the Supabase sign-in/redirect flow before relying on cloud sync.
