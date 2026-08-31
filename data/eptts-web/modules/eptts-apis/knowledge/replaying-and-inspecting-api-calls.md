# Replaying and inspecting API calls

Every one of the 351 API test cases is its own Automation Hub project, so **one replay runs
exactly one test case** and the artifacts it produces belong to that case alone. This doc is
about what you get back from a replay and how to take a request into Postman.

## Why this exists

An API test that only reports pass/fail is nearly useless when it fails. The question is
always *what did we actually send, and what came back?* — and with an async platform like
Masar that means the submission, the polls, and the final `messagestatus`, not just one call.
So every replay captures the full HTTP conversation and renders it the way an API client
would.

## What a replay produces

Alongside the usual Video and Trace links, an API replay adds two entries in the run history:

| Link | File | What it is |
|---|---|---|
| **Request / Response** | `api-log.html` | A self-contained viewer: every exchange in order, request pane beside response pane, method + status colouring, per-call timing. Opens in the browser, no dependencies. |
| **Postman** | `api-postman-collection.json` | The same exchanges as an importable Postman collection (schema v2.1.0), one request per call, in the order the test made them. |

A third file, `api-exchanges.json`, is written next to them for scripting — the raw record if
you want to diff two runs or feed results somewhere else.

These are produced in a `finally` block, so **a failing case still writes its log**. That is
precisely when you need it.

## Credentials are masked

`apikey`, `Authorization`, `Cookie` and `Set-Cookie` are replaced with
`«masked, N chars»` in all three files. The length is kept because a truncated or
wrong-length key is a real failure mode worth seeing, but the value never lands in an
artifact that might be attached to a ticket or shared.

**One thing to know:** Playwright's own call log prints request headers on failure, so a
failed `/auth` writes the raw key into raw run output and `trace.zip`. Both are gitignored,
but do not paste raw run output or share a trace file.

## Taking a request into Postman

1. Replay the case in the Automation Hub.
2. Click **Postman** in the run history to download `api-postman-collection.json`.
3. In Postman: *Import* → drop the file.
4. The masked `apikey` / `Authorization` headers need real values. Import
   `automation-hub/exports/eptts-apis.postman_environment.json` as an environment and fill
   in `mfgApiKey` / `branchApiKey` / `pharmacyApiKey` from `automation-hub/.env`, then select
   that environment.

Two values are single-use and must be refreshed before a re-send:

- **`instanceIdentifier`** — the platform rejects a reused one. The hand-maintained
  collection has a pre-request script that stamps a fresh one; a run-exported collection
  carries the literal value the test used, so change it.
- **EPC serials** — a commissioned SGTIN cannot be commissioned again. Bump the serial.

## The Swagger view

`automation-hub/exports/eptts-apis.openapi.json` is an OpenAPI 3.1 description of all 8
endpoints. **The platform publishes no spec of its own** — `/v3/api-docs` and `/swagger-ui`
return `200 text/html`, but that is nginx's SPA catch-all, and a deliberately bogus path
returns `200` too. So this one is hand-derived from live probing.

To browse it: open <https://editor.swagger.io> and paste the file in, or point any Swagger UI
at it. Postman also imports OpenAPI directly (*Import → OpenAPI*), which is a second route to
a working collection.

It describes the **live platform**, not the vendor document, and flags each divergence in the
operation it affects — `/auth` living on registry-service, `apikey` being used only at
`/auth`, `/Dispensation` being asynchronous, and the two probable defects (empty `eventList`
accepted, half-supplied credentials accepted). Regenerate with
`node scripts/eptts-web-openapi.js --write`.

## The hand-maintained collection

`automation-hub/exports/eptts-apis.postman_collection.json` is the one to reach for when you
want to *explore* the API rather than reproduce a specific test. It is one representative
request per operation (24 requests across 8 folders) with pre-request scripts that keep
timestamps, `instanceIdentifier` and serials fresh, plus `pm.test` assertions. Regenerate it
with `node scripts/eptts-web-postman.js --write`.

Its contract differs from the vendor's "Masar B2B API — Role Scenarios" collection in three
ways that made that collection fail against this build — see
[verified-live-contract.md](verified-live-contract.md).

## Reading an async result

Most endpoints return `202` and mean nothing yet. The log will show the submission followed
by repeated `MsgStatusQuery` calls. What decides pass/fail is the final `messagestatus`:

- `S - Successful` — the events were applied.
- `E - Application Error` — rejected; the `logList` says which event and why. This is the
  field to quote in a bug, not the `202`.

A `202` with an `E` outcome is the single most common way to misread this API. If a test
asserts a rejection and you see `202` in the log, keep reading to the poll results.
