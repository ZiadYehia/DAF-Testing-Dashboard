# Automation Hub

Self-contained module for authoring, replaying, and editing Playwright automations
from inside the Testing Dashboard. Kept in this top-level folder (not under `src/`) so
it can be developed independently — the Next.js app touches it only through thin
route/page shims that import from here.

The hub is **multi-app**: it can automate any number of target applications. Everything
app-specific (base-URL env key, login flow) lives in one registry — `lib/apps.ts`.

## The two-engine model

Authoring a test and replaying it are different machines:

| Phase | Engine | Notes |
|-------|--------|-------|
| **Authoring / first run** | Claude + Playwright **MCP** (live browser) | Non-deterministic, AI-driven. Emits a `.spec.ts`. |
| **Replay / rerun** | Playwright **Test runner** (child process) | Deterministic, free, records video + trace. |

The "MCP Chat" tab and free-form authoring are the *same* MCP loop surfaced two ways.

## Layout

```
automation-hub/
  .env                  secrets + base URLs (gitignored; see .env.example)
  .auth/<app>.json      cached login state per target app (gitignored)
  types.ts              shared types + MAX_RUN_HISTORY
  playwright.config.ts  video+trace on; `setup` project logs in, `chromium` runs specs
  store.ts              project CRUD over projects/, meta.json, env-key listing
  lib/
    env.ts              loads .env into the test child; requireEnv()
    apps.ts             TARGET APP REGISTRY — slug, base-URL env key, login flow
    auth.ts             login(page, app) + ensureLoggedIn(page, app, path)
    auth.setup.ts       setup project: caches .auth/<app>.json with a TTL
  engine/
    runner.ts           spawns `playwright test`, watchdog-kills hangs, archives artifacts
    mcp-client.ts       Playwright-MCP stdio client + Claude tool loop (authoring)
    codegen.ts          session/testcase → spec, spec revision; injects hub conventions
  projects/
    <name>/
      test.spec.ts      editable + replayable
      meta.json         ProjectMeta (app, tags, status, run history newest-first)
      runs/<ts>/        video.webm, trace.zip, result.json   (gitignored)
```

## Adding a new target app

1. Add its env keys to `automation-hub/.env` (e.g. `CRM_BASE_URL`, `CRM_PASSWORD`).
2. Add one entry to `TARGET_APPS` in `lib/apps.ts`: slug + base-URL key + login flow.

Nothing else changes. Specs opt into the app's cached auth with
`test.use({ storageState: stateFor('<slug>') })` and start with
`await ensureLoggedIn(page, '<slug>', '/start/path')` — the AI codegen is prompted to
emit exactly this, and to reference `process.env.<KEY>` instead of hardcoding secrets.

## How replay works (engine/runner.ts)

1. Spawn Playwright's CLI via `node` (no shell — paths may contain spaces) with a
   **relative POSIX filter** `projects/<name>/test.spec.ts` (the positional arg is a
   regex matched against the path relative to cwd). The `setup` project runs first and
   refreshes any stale `.auth/<app>.json` (TTL: `AUTH_STATE_TTL_MIN`, default 30 min).
2. A watchdog kills the whole child tree after `AUTOMATION_RUN_TIMEOUT_MS`
   (default 5 min) so a hung browser can never block the project forever.
3. Parse the JSON reporter for duration + first error; pass/fail from the exit code.
   `retries: 1` absorbs one-off flakes; the UI flags projects whose recent history
   flip-flops as **Flaky**.
4. Lift `video.webm` / `trace.zip` out of the raw `--output` dir into `runs/<ts>/`.
5. Record the run in `meta.json`, prune folders beyond `MAX_RUN_HISTORY` (10).

An in-process lock allows one replay per project at a time.

## Regression runs

- **UI "Run all"** — replays the (tag-filtered) list sequentially with live progress.
- **`POST /api/[app]/automation/run-all`** `{ tag? }` — server-side regression for CI
  or scripting (`src/lib/automation-regression.ts`); syncs linked test cases.
- **Scheduled** — Settings → Automation: daily run at a configured time, optional tag
  filter (`src/lib/automation-scheduler.ts`, started from `src/instrumentation.ts`).
- Server-side regressions post a summary to the configured webhook
  (`AUTOMATION_WEBHOOK_URL`) as `{ text }` — Slack/Teams compatible.

Projects carry **tags** (e.g. `smoke`, `orders`) to slice regressions, file into suite
**folders** (collapsible groups in the UI, each runnable as a unit), and belong to the
dashboard **app** they were created under (legacy projects show everywhere).

## Test-case linking & bug reporting

A project can be linked to a dashboard test case at creation (chat / generate paths)
or any time later ("Link test case" in the detail view; unlink from the badge).
Replays sync the linked case's pass/fail to the feature's execution tab.

"Report bug" in the detail view (also next to "Fix with AI" on a failure) reuses the
dashboard's bug pipeline: the description is seeded with the replay failure context,
AI-generates a structured report, and the bug is created under the feature. When a
test case is linked, the testcase→bug link is recorded too, so the bug shows up in
the execution tab against that case; unlinked automations pick a feature and create
the bug without a link.

## Wiring into the app

- Page: `src/app/[app]/automation/page.tsx` → `src/components/automation/AutomationHub.tsx`
- API: `src/app/api/[app]/automation/**` (list/create, get/save/delete, run, run-all,
  artifacts, chat, testcases)
- Import alias: `@automation-hub/*` (tsconfig). Playwright is in `serverExternalPackages`.

## Roadmap

- **Phases 1–5 (done):** runner + replay UI, MCP chat authoring, codegen, test-case
  linking + status sync, run-all + AI self-heal.
- **Phase 6 (done):** env/secrets layer, per-app auth registry + cached storage state,
  runner watchdog, retries + flake detection, tags, scheduled regression + webhook,
  app-scoped projects.
- Next candidates: shared helper library for generated specs, CodeMirror editor,
  embedded trace viewer, automation-coverage view per feature, auto-draft bug on
  repeated failure.

## Deployment note

Local-only for now. To run replays in Docker/Railway, add Playwright browser install
(`npx playwright install --with-deps chromium`) to the Dockerfile.
