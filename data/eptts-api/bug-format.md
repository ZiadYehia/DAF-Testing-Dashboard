# Bug Report Format

## Required sections

Bug files live at `data/eptts-api/bugs/<feature>/<slug>.md` and use YAML frontmatter followed by a
markdown body whose sections are separated by `---` horizontal rules. (This is the EPTTS API copy of
the format; the dashboard copy at `data/eptts-web/bug-format.md` files under `data/eptts-web/bugs/`.)

Frontmatter fields: `title`, `status` (`draft` | `reported`), `jira_key` (`DW-###` or `null`),
`reported_at` (ISO timestamp or `null`), `feature` (must match the feature folder name, e.g.
`api-commission`, `web-master-data`, `registry-products`), `priority`, `bug_type`, `parent_key`,
`severity`, `layer`, `jira_status`, `jira_reporter`. This app additionally records `found_by` and
`found_at` so a bug found by an automated run is traceable to that run.

### `environment` — which server the bug was found on

Optional, and omitted means the bug is not attributed to a named environment (every bug filed
before environments were tracked). When present it must match an environment's name in the app
exactly, e.g. `environment: ngrok relay`.

**When it is set, the filename must end with the slugified environment** —
`<slug>-ngrok-relay.md`. This is enforced by `scripts/eptts-validate-bugs.js`, because the same
defect found on two servers is two reports, and identical slugs would mean one silently
overwriting the other. The field is also a real column on `bugs`, so the dashboard can list and
filter by it rather than the reader parsing prose.

It does not replace the **Environment:** body section, which still carries the exact URL,
tenant, acting role and GLN. The field says *which target*; the section says *what that target
was*. A relay tunnel's URL changes between sessions, so the name is the stable identifier and
the URL is the evidence.

Body sections in order, each separated by a `---` rule with a blank line on either side,
exactly as `bugs/_template.md` shows:

1. **Summary** - ONE short paragraph. What is broken, and the consequence for traceability.
   Keep it tight: a developer opening the bug should reach the reproduction steps immediately.
   Follow it with a single `**Covers test cases:**` line naming the cases that produced it.
2. **Steps to Reproduce:** - numbered, each one atomic action. Always start from connecting the
   Citrix VPN, since nothing is reachable without it.
3. **Expected Result:** - ONE clear sentence.
4. **Actual Result:** - ONE clear sentence, quoting the platform's own message where one exists.
5. **Environment:** - plain lines, one fact per line: platform/browser, the exact URL or
   endpoint, tenant and acting role with its GLN, and the TLS caveat.
6. **Priority:** - repeats the frontmatter value.
7. **Bug Type:** - repeats the frontmatter value.

There is NO Notes section, and no long-form discussion. Evidence goes in the attachments, not
in the body: request/response exchanges are attached as images, and the dashboard shows them
beside the report. A bug that has to be read twice to find the defect has failed at its job.

## Severity / priority conventions

`P1 – Critical` | `P2 – High` | `P3 – Medium` | `P4 – Low`. The em-dash form is canonical.

For this platform, priority tracks *traceability consequence*, not visibility:

- **P1** — anything that lets the traceability record become wrong or unverifiable: duplicate
  commissioning, silent master-data overwrite, custody transfer to the wrong GLN, a missing audit
  entry, wrong invoice arithmetic. Also anything that blocks a whole feature's test coverage.
- **P2** — missing input validation that lets bad data in, a page or capability unreachable through
  the UI, a wrong figure on a reporting surface.
- **P3** — validation gaps with no data-integrity consequence, cosmetic or copy issues, gaps that
  only hide a client's own bug.

`bug_type` is a closed set: `Functional` | `Functional / Integration` | `Functional (Backend/API)` |
`Functional — Intermittent / Flaky` | `UI/UX`.

`status` is `draft` until filed in Jira, at which point it gains a `jira_key` (`DW-###`) and a
`reported_at`. EPTTS, EPTTS Web and Dawana share one Jira board, so keys use the `DW-` prefix
regardless of which app the bug came from. A test case whose Status is `Fail` must carry the
matching `DW-###` key(s) in its Attachment column, space-separated.

## Attachments

Evidence goes in `data/eptts-api/bugs/<feature>/<slug>-attachments/`. Accepted types include
`.jpg`, `.png`, `.gif`, `.webp`, `.mp4`, `.webm`, `.mov`, up to 25 MB each. For API bugs the
request/response pair belongs **in the body** (the platform accepts only images/video, so a `.json`
attachment would sit unrecognised) — `scripts/eptts-api-bug-evidence.js` embeds the masked exchange.

Two conventions specific to this app:

- **Use `.jpg`, not `.png`, for screenshots.** The repository `.gitignore` contains a blanket
  `*.png`, so a PNG attachment is silently never committed.
- **Name evidence in reproduction order** (`1-start-…`, `2-after-click-…`, `3-page-exists-…`) so the
  attachment list reads as the sequence of the defect.

Video is strongly preferred for navigation, state-transition and timing defects, where a still frame
cannot show that *nothing happened*. Playwright records `.webm` via `recordVideo` on the browser
context; the file is only flushed when the context closes.

## Verify before filing

Every bug in this app is expected to have been reproduced against the live environment, with the
platform's own response quoted. During the first round two candidate defects were dropped at this
step because the evidence disproved them:

- "sidebar items are broken links" — they are *collapsible group headers*, and expanding rather than
  navigating is correct behaviour. The real defect was that the groups are empty.
- "product GTIN and name are swapped platform-wide" — only 1 of 100 records is affected, and the
  Registry UI renders it correctly, so the defect is narrower and lives in the API/data.

If a claim cannot be reproduced on demand, it does not get filed.
