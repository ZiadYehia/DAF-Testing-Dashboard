# web-information-center — Feature Knowledge

## Why this feature matters

The only page every role can reach, which makes it the platform's de-facto fallback route. That
matters for testing beyond its own content: when navigation fails, this is where Admin,
Manufacturer and Distributor land, so "ended up on Information Center" is a signal that something
else broke. Pharmacy is the exception — it lands on `/scanning`.

It is also the *consumer* half of a two-feature workflow. Nothing here is authored here; everything
comes from `/admin/announcements` in the Administration module. A gap on this page is usually a gap
there.

## The one thing that will waste your time

**A published announcement is invisible here until its audience is saved.** Publishing does not
write an audience row. The Audience dialog renders "Target all users" as already checked even when
`GET .../announcements/<id>/targets` returns `[]`, so the admin UI gives no hint that the
announcement reaches nobody.

Proven by controlled experiment on 2026-09-02:

| Record | status | targets | Visible on this page |
|---|---|---|---|
| `QA-20260902-REG-001` (`8ff07804-…`) | published | `[]` | **No** |
| `QA-20260902-TRN-002` (`61731499-…`) | published | `[]` | No |
| `QA-20260902-TRN-002` after Save Audience (`POST /targets` → 201) | published | 1 row | **Yes, immediately** |

If this page looks empty, check `targets` before assuming the page is broken.

## Endpoints this page depends on

Captured from the browser during discovery, so this is what the page really calls:

```
GET /masar-service/api/v1/users/me
GET /masar-service/api/v1/information-center/announcements/urgent
GET /masar-service/api/v1/information-center/announcements/pinned
GET /masar-service/api/v1/information-center/announcements
GET /masar-service/api/v1/information-center/announcements/upcoming-dates
GET /masar-service/api/v1/information-center/announcements?category={training|user_guides|integration|system}
```

Plus `?category=<selected>` and `?category=<selected>&search=<term>` on interaction. A failure in
any of these surfaces here, so check the endpoint directly before concluding the page is at fault.

## Panel-to-data mapping

| Panel | Populated by | Conditional |
|---|---|---|
| Urgent banner | `isUrgentBanner: true` | Yes — absent when none |
| Pinned Announcements | `isPinned: true` | Yes — absent when none |
| Latest Updates | everything visible; the only panel with search + category | No |
| Upcoming Dates | `eventDate` is set | No — shows empty state |
| Guides and Resources | categories `training`, `user_guides` | No |
| Support and Help | category `system` | No |

Two panels only exist when matching data exists, so an empty tenant hides a third of the feature.
That is why the fixtures below are worth keeping.

## Test data — Observed

Six announcements created via `/admin/announcements` on 2026-09-02, all titled `QA-20260902-*`:

| Tag | Category | Flags | Audience | Purpose |
|---|---|---|---|---|
| `REG-001` | Regulatory | pinned | **none** | Permanent negative fixture for the audience defect |
| `TRN-002` | Training | — | all users | Latest Updates, Guides and Resources |
| `DLN-003` | Deadlines | eventDate 2026-09-30 | all users | Upcoming Dates |
| `SYS-004` | System | pinned | all users | Support and Help, Pinned |
| `UGD-005` | User Guides | pinned | all users | Guides and Resources, Pinned |
| `URG-006` | Regulatory | urgent banner | all users | Urgent banner |

`REG-001` is deliberately left with no audience. Do not "fix" it — it is the live reproduction for
the audience defect, and it is why baseline counts on this page are **5**, not 6.

## Confirmed behaviour

- Search is server-side, debounced, and composes with the category filter.
- Search matches Arabic content: searching the Arabic word for maintenance returns `SYS-004`.
- A SQL fragment and a script tag in Search both return the empty state, with no error and no
  execution — the parameter is handled as a literal.
- The category dropdown has a clear icon that restores "All categories" and the full result set.
- Both filters reset on reload; neither appears in the URL.
- Both filters survive an AR/EN switch.
- Opening a card's detail dialog increments `viewCount`.
- All four roles see identical content.
- A Pharmacy opening `/admin/announcements` directly is redirected to `/scanning`.

## Corrections to earlier discovery

Three claims made during the first discovery pass were wrong, and each was overturned by a more
careful re-test. They are kept here because each one is a trap worth not repeating.

- **The user chip is NOT inert.** It opens a **Profile dialog** carrying *Edit Name* (Full Name,
  Save Changes) and *Change Password* (Current Password, New Password). The first pass called it
  inert because it was clicked via `element.click()` from `page.evaluate`, which does not drive
  Angular's handler the way a real pointer event does. **Drive controls with real clicks before
  calling anything inert.** The Profile dialog is an undocumented surface reachable from every
  page and has no feature folder of its own — a Change Password form deserves its own coverage.
- **The dashboard really does default to Arabic.** The first pass observed `lang=en` and doubted
  it. That was a persisted `localStorage.lang` in the automation browser profile. A clean context
  with no stored preference loads `lang=ar`, `dir=rtl`, with every group header in Arabic.
- **View counting does not fire on render.** Briefly suspected when `UGD-005` read `1`. It does
  not: `SYS-004` stayed at `0` across many renders in the Pinned panel, while `DLN-003` went
  `0 -> 1` on a single detail open. Views count on detail open only.

## Needs clarification

- The header icon button with `title="Information Center"` is clickable, carries a ripple and a
  title, but three real clicks produce no navigation, no dialog and no toast. Filed as
  `draft:the-header-icon-button-is-styled-as-clickable-but-has-no-effect` pending a product answer
  on what it was meant to do.
- The Profile dialog does not close on Escape; only its X button dismisses it. Standard PrimeNG
  behaviour for a form dialog with unsaved input, so recorded rather than filed.

## Cross-feature findings raised from this feature

Found while creating the fixtures above. All belong to `/admin/announcements`
(`web-announcements`, Administration module) and are recorded here so they are not lost:

- Editing a **published** announcement fails `PATCH … → 400` with a correct backend message
  (must be in draft status to edit freely; editing published requires the unpublish action), but
  the UI offers the Edit action anyway and shows **no toast and no inline error** — the dialog just
  sits there.
- A date **typed** into a datepicker displays in the input but is discarded on blur and saves as
  `null`, with no validation message. Only calendar selection persists.
- The status filter and the create dialog's Category dropdown render raw snake_case enum keys
  (`pending_review`, `user_guides`) while the table body renders proper labels.
- The five icon-only row actions carry no `title` and no `aria-label`.

## What every case here has to account for

- **The Citrix VPN is a hard precondition.** Nothing on `192.168.225.195` resolves without it, and a
  dropped VPN looks exactly like a hung server. Rule it out before diagnosing anything.
- **TLS is a self-signed certificate.** Playwright needs `ignoreHTTPSErrors: true` (including in
  `browser.newContext()`, which does *not* inherit it from the config's `use` block), the Playwright
  MCP server needs `--ignore-https-errors`, curl needs `-k`.
- **The production-access disclaimer** appears once per user and its backdrop intercepts clicks.
  Acceptance is stored in `localStorage` as `ettp_disclaimer_accepted_<userId>`.
- **Two unrelated auth systems.** The dashboard is Keycloak OIDC (realm `masar`, client
  `masar-dashboard`, Authorization Code + PKCE); the B2B API is an `apikey` exchanged for a
  15-minute bearer token. Keycloak's direct password grant is **disabled**, so dashboard automation
  must drive the real browser login.
- **Secrets never go in `data/`.** It is committed. Reference the env key name
  (`EPTTS_EF_PHARMACY_USERNAME`), never the value.

## Automation mapping

27 of the 30 cases are automated as Automation Hub projects under
`automation-hub/projects/eptts-web-information-center-<lowercased-id>/`, each linked to its case
id and each carrying a real recorded run. They reuse `pages/eptts-web/dashboard.page.ts` for the
shell and `pages/eptts-web/information-center.ts` for this screen's regions.

`WEB_INF_028` is automated as a **known gap**: the spec asserts the correct behaviour and carries
`test.fail()`, so the recorder maps it to `fail` and it flips to a loud unexpected pass the day the
platform is fixed. Do not rewrite it to assert the empty state.

`WEB_INF_011` is the one spec that is not read-only — it increments the view counter on a QA
fixture, which is the only way to observe the behaviour.

Three cases are **Manual only**, each for a reason that automation cannot currently reach:

| Case | Why not automated |
|---|---|
| `WEB_INF_024` | Needs four authenticated roles in one run. The hub caches one storage state per app slug (`.auth/eptts-web.json`), so there is no second or third identity to switch to. |
| `WEB_INF_025` | Needs a Pharmacy storage state for the same reason. |
| `WEB_INF_029` | Logs out, which invalidates the shared cached auth state that every other spec in the run depends on. |

The first two become automatable if the hub gains per-role storage states for this app.

## Case history and provenance

Per-case history for this feature: where each case came from, what was verified, and in what
environment. Kept here rather than in the test-case table, which holds only the 13 columns.

### Provenance

The previous seven cases (`WEB_INF_001`–`007`) were machine-generated by
`scripts/eptts-web-dashboard-features.js` from a discovery manifest and asserted generic page
properties against an empty tenant — "Validate that search filters the result set" with
`Test Data: Not Applicable`. They were discarded and this table was authored from live discovery on
2026-09-02, renumbered from `_001`, after creating the fixtures that make the feature observable at
all.

### Verification status

Executed against the devsim tenant on 2026-09-02 as Platform Admin, with role checks as Distributor
and Pharmacy.
