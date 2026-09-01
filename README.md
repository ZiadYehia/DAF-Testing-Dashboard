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

### Getting disk edits into the app

`npm run db:import` is **insert-only**: it creates rows that do not exist and never overwrites
one that does. That protects anything edited in the UI from being clobbered by a stale file,
but it means editing a file that already has a row changes nothing in the app — and because
reads are DB-first, the dashboard keeps serving the old copy with nothing on screen to say the
two disagree. `db:import` reports success either way.

So after editing `data/` by hand or from a script, run the matching sync tool. Each takes
`--app <slug>` and supports `--dry-run`; none is wired to an npm alias, deliberately.

```bash
npx ts-node database/src/seed/sync-bugs.ts --app eptts-api --dry-run           # bug bodies + frontmatter
npx ts-node database/src/seed/sync-executions.ts --app eptts-api --dry-run     # execution statuses + notes
npx ts-node database/src/seed/sync-modules.ts --app eptts-web --dry-run        # module manifests
npx ts-node database/src/seed/sync-feature-modules.ts --app eptts-web --dry-run # feature -> module assignment
```

`sync-bugs` does not treat disk as authoritative for everything: **status, jiraKey,
reportedAt, jiraStatus and jiraReporter belong to the app**, since reporting to Jira happens
in the UI and is never written back to the file. It updates the authored content (title, body,
priority, type, severity, layer) and reports where a file's frontmatter has fallen behind.

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
