# Testing Dashboard — Workspace Instructions

This workspace is a **general, app-agnostic QA platform**. It has no hardcoded
applications: apps are registered in `data/apps.json` (via the admin UI at
`/admin/apps`), and everything — test cases, bugs, knowledge, requirements,
automation — is scoped per app under `data/<slug>/`.

It combines:
- **Test Case Management** — write, generate, and review test cases per feature
- **Bug Reporting** — write, edit, and report bugs to Jira
- **Requirements Tracking** — view and update the Functional Requirements master list
- **Domain Knowledge** — per app / module / feature knowledge that feeds AI generation
- **Automation Hub** — Playwright (web apps) and Appium (mobile apps) test authoring + replay

The dashboard UI runs at **http://localhost:3000** (`npm run dev`). QA content is stored
as markdown/JSON files under `data/` (source of truth); a SQL Server database mirrors it
for querying and holds auth, settings, and execution history.

---

## Apps

Do not assume any specific app. Read `data/apps.json` for the current registry —
each entry has `slug`, `name`, `type` (`web` / `mobile` / `desktop`), and capabilities.
App pages live at `http://localhost:3000/<slug>`.

## Folder Structure (Data)

```
data/
  apps.json                 ← app registry (THE only place apps are defined)
  <slug>/
    features/<feature>/     ← workflow.md, <feature>-testcases.md, metadata.json, screenshots/
    bugs/<feature>/         ← one markdown file per bug (YAML frontmatter)
    knowledge/              ← domain knowledge + testcase writing rules
    requirements/           ← FRs.md
    modules/<module>/       ← module-scoped knowledge
```

## Shared instructions

Format rules that apply to every app live in `.github/instructions/shared/`
(test-case table format, feature analysis method, global conventions).
