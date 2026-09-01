---
title: >-
  [Audit] The GLN filters on all four audit tabs accept a GLN whose check digit is wrong and
  answer "No records match these filters", advising the user to widen the date range
status: draft
jira_key: null
reported_at: null
feature: web-audit-integrity
priority: P3 – Medium
bug_type: Functional (Backend/API)
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-09-01T05:45:00.000Z'
---
Every audit tab that filters by GLN takes `8435308300003` — thirteen digits, correct shape,
**check digit wrong** — runs the query, and reports:

> **No records match these filters**
> Records exist in this log; none of them match the filters you have applied. Widen the date
> range or clear a filter to see more.

That answer is not merely unhelpful, it is wrong in a specific way: it tells the user their
filter is *valid but unmatched*, and directs them to widen the date range. No date range will
ever match, because the GLN cannot identify anything — it is not a GLN. The user is sent to
adjust the one input that is not the problem.

| Tab | Route | Filter placeholder |
|---|---|---|
| Integrity | `/audit` → Integrity | `Filter by GLN` |
| Regulatory events | `/audit` → Regulatory events | `13-digit GLN` |
| EDA submissions | `/audit` → EDA submissions | `13-digit GLN` |
| Master-data changes | `/audit` → Master-data changes | `GLN or GTIN` |

**The placeholders show the intent.** Two of the four say "13-digit GLN", so the field knows it
wants a GLN and not free text; it just never checks the one rule that distinguishes a GLN from
thirteen arbitrary digits. The check is four lines of arithmetic (GS1 mod-10) and needs no
backend call.

**Why it matters here rather than being cosmetic.** These are the audit screens — the ones
someone opens to answer "is our traceability record complete for this party?". A malformed GLN
returning "no records match" is indistinguishable from a correct GLN with genuinely no events.
An investigator can copy a GLN with one digit mistyped, see an empty audit log, and conclude a
party has no recorded activity when in fact they were never queried. That is a wrong conclusion
drawn from the audit trail, which is the one thing these screens exist to prevent.

This was checked for a message anywhere on the page, not just in the tab panel: there is **no
toast, no inline error, and no console-visible complaint**. The empty state is the entire
response.

**For contrast, the platform gets this right elsewhere.** The Add Manufacturer dialog's Verify
control answers a GLN it cannot check with a clear page-level toast — "GS1 verification is not
enabled in this environment". So the toast mechanism exists and is used for exactly this class
of problem; these four filters simply do not use it.
---
**Steps to Reproduce:**
1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Log in as admin@devsim.local and switch the UI to EN.
3. Navigate to Reports → Audit Console (`/audit`) and select the **Integrity** tab.
4. Type `8435308300003` into the "Filter by GLN" box and press Enter.
   (`8435308300002` is the valid form of the same GLN — the last digit is the check digit.)
5. Read the table and watch the top-right corner of the page for a toast.
6. Repeat on the Regulatory events, EDA submissions and Master-data changes tabs.
---
**Expected Result:**
1. The filter refuses the value and says why — for example "Not a valid GLN: check digit does
   not match" — either inline under the field or as a toast.
2. No lookup is issued, because the value cannot identify a party.
---
**Actual Result:**
1. The lookup is issued and the table shows the empty state: "No records match these filters —
   Records exist in this log; none of them match the filters you have applied. Widen the date
   range or clear a filter to see more."
2. No validation message appears anywhere on the page: no inline error, and no toast within
   6 seconds of the query.
3. All four tabs behave identically.
---
**Environment:**
- Masar Platform
- https://192.168.225.195:8444
- `/audit` (Integrity, Regulatory events, EDA submissions, Master-data changes tabs)
- tenant devsim
- role admin (admin@devsim.local)
- UI in English
- Chrome 1600×1100
- via Citrix VPN
- host serves a self-signed certificate

**Evidence:** `invalid-gln-returns-no-records-match.jpg` — the Integrity tab with
`8435308300003` in the "Chain status by GLN" box. The table reads "No records match these
filters … Widen the date range or clear a filter to see more", and no validation message
appears anywhere on the page. Note the summary above it: the log holds 48,074 records.
---
**Priority:**
P3 – Medium
---
**Bug Type:**
Functional (Backend/API)
---
**Notes:**
**Covers test cases:** `WEB_AIN_007`, `WEB_ARE_007`, `WEB_AES_005`, `WEB_AMD_005`

Covered by four automated cases, all of which assert that a validation message appears and
currently fail. The assertion looks for a complaint both inline and in a page-level toast —
scoping it to the tab panel alone would have missed the toast idiom this platform uses
elsewhere.

The equivalent cases on the four "Add …" forms (`WEB_SMF_007`, `WEB_SDP_007`, `WEB_SBP_007`,
`WEB_SPA_007`) are **not** part of this bug and are recorded as blocked, for two separate
reasons: on Manufacturer the GS1 verification path is switched off in this environment, and on
Dispenser there is no way to have a GLN checked without pressing Create, which would create a
record on production.
