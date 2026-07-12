# General Testing Dashboard

Unified, **app-agnostic** QA platform: test-case management, bug reporting (with Jira
sync), requirements tracking, domain knowledge, a retest board, and an Automation Hub —
for any number of applications.

No app is hardcoded. Apps are registered in `data/apps.json` (managed from the admin UI
at `/admin/apps`), and every page, API route, and AI prompt is scoped by the app slug.

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

Configuration lives in `.env.local` (database, session secret; AI provider and Jira keys
optional — they can also be set in the Settings UI, where DB values override env).
See `SETUP.md` for the full walkthrough including SQL Server setup.

```bash
npm run db:migrate      # create schema
npm run db:seed-admin   # create admin user from SEED_ADMIN_* env
```

## How data is organized

Markdown/JSON files under `data/` are the source of truth; the database mirrors them for
querying and stores auth, settings, and execution history.

```
data/
  apps.json                 ← app registry (the only place apps are defined)
  <slug>/
    intake.json             ← structured intake → compiles knowledge/config files
    features/<feature>/     ← workflow.md, <feature>-testcases.md, metadata.json, screenshots/
    bugs/<feature>/         ← one markdown file per bug (YAML frontmatter)
    knowledge/              ← domain knowledge + test-case writing rules
    requirements/           ← FRs.md
    modules/<module>/       ← module-scoped knowledge
    automation.json         ← web-login config for the Automation Hub (optional)
```

Onboard a new app: create it in `/admin/apps`, then fill the intake wizard (or drop
hand-written files into `data/<slug>/`).

## Automation Hub (`/[app]/automation`)

Two engine families, selected by app type:

- **Playwright** (web apps) — AI-authored via MCP chat or hand-written specs; replay
  with video + trace; optional Python/pytest artifacts with shared page objects under
  `automation-hub/python/pages/<app>/`.
- **Appium** (mobile apps) — Android via real device (`udid`, `noReset`, pre-installed
  app) or emulator (AVD + APK); replay with video.

Projects live in `automation-hub/projects/<name>/`; per-app login/env config in
`automation-hub/.env` (see `automation-hub/.env.example` for the per-app key pattern).
