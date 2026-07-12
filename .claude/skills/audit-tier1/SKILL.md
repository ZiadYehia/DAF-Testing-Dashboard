---
name: audit-tier1
description: Two-pass codebase audit — security first, then deps, duplication, refactors, health checks. Pass 1 reports prioritized findings tables; Pass 2 fixes only after user confirms. Use when user asks for a codebase audit, security review + cleanup, or "tier 1 audit".
---

# Tier 1 Codebase Audit

Act as senior software engineer + security reviewer. Audit codebase, fix what's safe. Practical — no over-engineering, no unrequested abstractions, no rewriting working code for "cleanliness".

## Quick check (always first)
- Detect stack: language, framework, package manager. Read package.json / equivalent.
- Detect tests. If none: say so, do NOT claim any change is "safe" or "functionally equivalent". Point out riskiest changes and where a quick test would help first.

## PASS 1 — Find and report (NO code changes)

Fan out parallel read-only subagents (general-purpose) — one per dimension, plus run dependency scan inline in background:

1. **Security agent** (priority): hardcoded secrets/keys/tokens in code or committed config (check `git ls-files` for .env, docker-compose, CI configs); SQL/command/XSS injection (raw queries, spawn/exec with user input, dangerouslySetInnerHTML/eval, unsanitized markdown); missing/broken auth on routes (map the auth mechanism, list unguarded endpoints, middleware bypass gaps); sensitive data in logs/localStorage/URLs/API responses (especially settings endpoints returning raw keys to client); overly open CORS; path traversal in file-serving endpoints. Require file:line and severity per finding; instruct agent to verify every claim by reading actual code.
2. **Duplication + refactor agent**: logic copy-pasted 2+ places causing real maintenance pain (validation, API wrappers, formatting, DB boilerplate) — ignore coincidental similarity. Obvious refactors only: 300+ line functions, dead code (grep-verify before claiming), unused imports, confusing names. Reusable pieces only if extraction clearly pays off (3+ near-identical repeats). No architectural proposals. Rank by largest files first.
3. **Reliability agent**: missing error handling around network/IO (fetch without try/.ok, unguarded req.json(), unhandled DB throws, raw error leakage in 500s, spawns without handlers); perf (N+1 queries, uncached per-request directory scans, missing pagination, sequential awaits in loops); risky patterns (file-write races, unbounded memory, missing HTTP timeouts, dangerous auto-migrations). Also report what's solid — prevents re-flagging.
4. **Inline**: `npm audit` (or pip-audit etc.) + `npm outdated`. Spot-check the headline security finding yourself before reporting.

Report: prioritized table per section (severity | issue | file:line | why | fix). End with proposed fix order. STOP — wait for user confirmation.

## PASS 2 — Fix (only after user confirms)

Delegate implementation to parallel Sonnet subagents (Agent tool, model: sonnet) with NON-OVERLAPPING file sets. Order, with build check (`npm run build` or equivalent) between groups:

1. **Security first.** May change behavior on purpose — call out exactly what changes per fix (e.g. "settings become admin-only"). For secret-masking fixes: check client save flow first so masked values don't get written back over real keys.
2. **Dependencies.** Patch/minor bumps freely + `npm audit fix` (never `--force`). Majors: list separately with one-line migration note, do NOT apply. Update lockfile. Build after.
3. **Safe cleanups.** Only user-approved items. Must NOT change behavior. Show before/after per change.

## Rules
- Don't touch business logic without asking.
- Smallest change that solves problem.
- Big rewrite or breaking upgrade needed: flag with recommendation, don't do.
- Medium-risk refactors (heavily-used UI, 50+ call sites) with zero tests: defer unless explicitly approved.
- Save the Pass 1 report to `audits/audit-<m>-<d>-<yyyy>.md` with a Pass 2 status checklist at bottom; update checklist as waves complete.
- Final summary: security fixed, packages old→new, cleanups done, decisions still open.
