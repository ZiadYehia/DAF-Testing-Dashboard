---
type: rules
priority: 10
---
# Test-Case Writing Rules

## ID scheme

Two families coexist in this app and they are governed differently.

**API test cases** — IDs are **inherited verbatim** from `EPTTS - API TEST CASES.xlsx` and must never
be renumbered, renamed, or normalized. That spreadsheet is the historical record other people still
work from, so an ID here has to match an ID there exactly. This means the suite deliberately carries
an inconsistency: some areas use a `TC_` prefix and others use `TS_`.

| Feature | ID pattern |
|---|---|
| `api-authentication` | `TC_AUTH_###` |
| `api-commission` | `TC_COMM_###` |
| `api-packing` | `TS_PACK_###` |
| `api-unpacking` | `TS_UNPK_###` |
| `api-destruction` | `TC_DEST_###` |
| `api-shipping` | `TC_SHIP_###` |
| `api-receiving` | `TS_RECV_###` |
| `api-return` | `TS_RTN_###` |
| `api-return-receiving` | `TS_RTRV_###` |
| `api-dispensing` | `TC_DISP_###` |
| `api-partial-dispensing` | `TC_PDISP_###` |

Do **not** "fix" `TS_` to `TC_`. When adding new API cases, continue the existing prefix and counter
for that feature.

**Numbering is sequential and gapless, with one inherited exception:** `TC_COMM_022` does not exist —
the source spreadsheet skips it. That gap is preserved rather than closed, because renumbering would
break the 1:1 mapping back to the spreadsheet that every ID exists to protect. Any *new* gap is a
defect in the test data.

## Status reflects OUR verification, not inherited history

The Status column states what **this project** verified in **this environment**. It is not a place to
copy another environment's results into.

| Situation | Status | Execution status |
|---|---|---|
| Executed here and passed | `Pass` | `pass` |
| Executed here and failed | `Fail` + Attachment bug reference | `fail` |
| Executed here, could not complete | `Blocked/Skipped` | `blocked` |
| Not executed here yet | `Under Testing` | `new_added` |

The API cases arrived with statuses recorded against **staging by a different tester**. Carrying those
into the Status column would have claimed 279 passes this project never ran. They are preserved in
each feature file's `## Verification status` section as history, and deliberately excluded from the
Status column.

`new_added`, `pass`, `fail`, `blocked`, `ready` and `under_testing` are the **execution** vocabulary
(`src/lib/execution-types.ts`) used by `execution-status-v1.json`. They must never appear in the
Status column, which has its own four values.

**Dashboard test cases** — `<PORTAL>_<FEATURE>_###`: a 3-letter portal code (`WEB` for the main
dashboard, `REG` for the Registry portal, `BIL` for the Billing portal), a 3-letter feature code, and
a 3-digit zero-padded counter. The counter resets to `_001` per feature file, is strictly sequential,
and never skips. Unlike the API IDs these are ours to assign, so they must stay readable and
consistent in length.

| Feature | ID pattern |
|---|---|
| `web-information-center` | `WEB_INF_###` |
| `web-command-center` | `WEB_CMD_###` |
| `web-reporting` | `WEB_RPT_###` |
| `web-analytics` | `WEB_ANL_###` |
| `web-violations` | `WEB_VIO_###` |
| `web-audit-console` | `WEB_AUD_###` |
| `web-master-data` | `WEB_MDT_###` |
| `web-settings-admin` | `WEB_SET_###` |
| `web-products` | `WEB_PRD_###` |
| `registry-dashboard` | `REG_DSH_###` |
| `registry-parties` | `REG_PRT_###` |
| `registry-prefixes` | `REG_PFX_###` |
| `registry-products` | `REG_PRD_###` |
| `registry-register-pharmacy` | `REG_RPH_###` |
| `billing-dashboard` | `BIL_DSH_###` |
| `billing-unbilled-operations` | `BIL_UNB_###` |
| `billing-invoices` | `BIL_INV_###` |
| `billing-reports` | `BIL_RPT_###` |
| `billing-configuration` | `BIL_CFG_###` |

| `web-settings-government` | `WEB_SGV_###` |
| `web-settings-manufacturer` | `WEB_SMF_###` |
| `web-settings-distributor` | `WEB_SDS_###` |
| `web-settings-dispenser` | `WEB_SDP_###` |
| `web-settings-system` | `WEB_SSY_###` |
| `web-settings-platform` | `WEB_SPL_###` |
| `web-settings-system-configuration` | `WEB_SSC_###` |
| `web-settings-pharmacies` | `WEB_SPH_###` |
| `web-settings-pharmacy-admins` | `WEB_SPA_###` |
| `web-settings-pos-partners` | `WEB_SPP_###` |
| `web-settings-b2b-partners` | `WEB_SBP_###` |
| `web-settings-platform-staff` | `WEB_SPS_###` |
| `web-settings-user-locks` | `WEB_SUL_###` |
| `web-settings-geography` | `WEB_SGE_###` |
| `web-audit-regulatory-events` | `WEB_ARE_###` |
| `web-audit-eda-submissions` | `WEB_AES_###` |
| `web-audit-master-data-changes` | `WEB_AMD_###` |
| `web-audit-integrity` | `WEB_AIN_###` |
| `web-analytics-activity` | `WEB_NAC_###` |
| `web-analytics-inventory` | `WEB_NIV_###` |
| `web-analytics-shipments` | `WEB_NSH_###` |
| `web-analytics-expiry-risk` | `WEB_NER_###` |

Tabs are features too: a tab has its own table, controls and endpoints, so each of the
Settings, Audit Console and Analytics tabs is a separate feature rather than a section of
its parent route's feature. The parent route keeps a "shell" feature covering page load
and tab switching.

The prefix belongs to the feature, not the module: two features in the same module never share a
prefix, so a test-case ID always identifies exactly one feature file.

**Feature ID** column references the feature's own registered ID (`EPTTS_API_01` … `EPTTS_API_11` for
the API module; `EPTTS_WEB_##` for dashboard features), space-separated when a case covers more than
one.

## A known platform gap: assert what SHOULD happen, never what does

When the platform is wrong and we know it, the automated case must assert the **correct**
behaviour and carry an expected-failure marker naming the gap
(`expectFail: 'platform validation gap: …'`). The recorder then maps it to **`fail`** with the
gap as the note, and the case flips to a loud unexpected-pass — "remove the marker" — the day
it is fixed.

**Do not assert the observed defective behaviour.** It reads as a reasonable way to make the
suite green, and it is the one convention that cannot work:

- A case asserting the defect passes, so nothing distinguishes it from correct behaviour.
- Combined with `expectFail` it is self-contradictory — the body passes, Playwright reports
  "expected to fail but passed", and the recorder concludes the defect is FIXED.

That is not hypothetical. `TC_AUTH_007`–`TC_AUTH_010` were written asserting the platform's
real `200` (where `400` is required) *and* marked `expectFail`. All four were recorded as
passing, with a note saying the platform now behaved correctly. Four live defects were
reported as resolved. The rule exists because of it.

Where the platform is right and the **source spreadsheet** is wrong, that is the opposite
situation and needs no marker: assert the real behaviour and record the divergence in a
comment, so a reader knows the sheet was considered and overruled (see `TS_PACK_003`, where a
sealed SSCC correctly refuses new packs).

## Required fields / table format

Every test-case file starts with a single H1 heading (the feature name) followed by one markdown table
with these exact 13 columns in order (case-sensitive, preserve spacing):

`Feature ID | TestCase ID | Tester | Validity | Test Cases Title / Objective | Environment | Pre-condition | Test Data | Steps | Expected Results | Status | Attachment | Type`

- **Validity** — `Positive` or `Negative`.
- **Environment** — for this app always the production target:
  `Masar Platform · https://192.168.225.195:8444 · tenant devsim`. Never `Staging`.
- **Status** — `Pass`, `Fail` (requires an Attachment bug ID), `Blocked/Skipped`, `Under Testing`.
- **Attachment** — empty unless `Status=Fail`. When failing it must carry a bug reference:
  - a `DW-###` Jira key (EPTTS, Dawana and this app share one Jira board; multiple keys
    space-separated), or
  - `draft:<bug-slug>` pointing at a bug filed under `data/eptts-web/bugs/` that has not yet been
    raised in Jira. Every bug this project files starts as a draft, so this is the normal form
    until the drafts are pushed to Jira and gain keys. The slug is the bug filename without `.md`.

  A failing case with an empty Attachment is a rule violation: a failure with no filed cause is
  either an unrecorded defect or an unmaintained test.
- **Type** — `Functional`, `Security`, or `Integration`.

### A test-case file contains only test cases

`<feature>-testcases.md` is exactly one H1 heading and one 13-column table. **No prose sections, no
notes, no history.** Never widen the table either — the 13-column shape is parsed.

Anything that does not fit a column belongs in the feature's `knowledge.md`, under
`## Case history and provenance`: reviewer notes, where a case came from, what a previous environment
recorded, why a case is blocked, open questions for the PO. That is knowledge about the feature, not
a test case, and mixing the two makes the table harder to read and to diff.

The one exception is a per-case failure reason, which goes in `execution-notes-v1.json` keyed by
TestCase ID — it belongs to the *execution*, not to the case definition.

## Style rules

**Steps** are a numbered list on a single line inside the cell:
`1. {Action}. 2. {Action}. 3. {Action}.` Each step is exactly one atomic action. Steps must not repeat
the pre-condition and must flow from the state the pre-condition ends in. Max ~10 steps; split into
multiple cases if more are needed. `Repeat steps X-Y` is acceptable.

- **API cases** use request-level verbs: `Send`, `Post`, `Get`, `Poll`, `Query`, `Observe`, `Omit`,
  `Replace`, `Set`, `Reuse`. Name the endpoint being called, e.g.
  `1. Post an EPCIS document to /scp/SendEPCIS with a valid commissioning event. 2. Poll /MsgStatusQuery with the instanceIdentifier. 3. Query /VerifyProduct for the SGTIN.`
- **Dashboard cases** use UI verbs: `Click`, `Enter`, `Select`, `Navigate`, `Upload`, `Observe`,
  `Leave {field} empty`, `Scroll`, `Refresh`. This is a browser app — use `Click`, never `Tap`.

**Pre-conditions** are also a single-line numbered list.

- API: `1. Citrix VPN connected. 2. Authenticated as {role} with a valid API key (GLN = {gln}). 3. {data state}.`
- Dashboard: `1. Citrix VPN connected. 2. Browser open at https://192.168.225.195:8444. 3. Logged in as {role}. 4. User is on the {Page Name} page.`
  (Auth-feature cases drop the login items, since login *is* the test.)

**Expected Results** are single declarative present-tense sentences with **no modal verbs** (no
should / will / would / shall), naming the exact observable outcome. For asynchronous API endpoints
this means asserting the whole chain, not just the acknowledgement:

> `1. The response is 202 Accepted with an instanceIdentifier. 2. MsgStatusQuery returns SUCCESS. 3. The pack state is Commissioned.`

A case whose only expected result is a `202` is incomplete — `202` means queued, not applied.
Unclear business rules get `(as per business rules)` or `(TBD with PO)` appended rather than a guess.

**Test Data** uses `Not Applicable` (never `N/A`) when nothing specific is needed, `FieldName: value`
format for specific values, and semicolons between multiples, e.g.
`SGTIN: urn:epc:id:sgtin:629000999.0001.Serial1; Lot: LOT-MFG-001; Expiry: 2028-12-31`.

**Secrets are never literals.** `data/` is committed to git. Reference the env key name instead:
`API Key: EPTTS_MFG_APIKEY (automation-hub/.env)`, `Password: EPTTS_WEB_ADMIN_PASSWORD`.

## Priority scale

Test cases carry no priority column. The underlying features are tiered in their `workflow.md`
Feature Details table:

- **P1** — authentication, commissioning, shipping, receiving, dispensing, admin partner/API-key
  management. The supply chain does not function without these.
- **P2** — packing, unpacking, returns, return receiving, partial dispensing, product catalogue.
- **P3** — destruction and other exception events, reporting, master-data snapshot, settings.

Bugs use a 4-level scale: `P1 – Critical` | `P2 – High` | `P3 – Medium` | `P4 – Low` (the em-dash +
word suffix is the canonical form).
