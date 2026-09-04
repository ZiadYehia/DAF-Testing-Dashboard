# Information Center — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Information Center |
| **Slug** | `web-information-center` |
| **Feature ID** | `EPTTS_WEB_01` |
| **Module** | Information Center |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/information-center` |
| **Text direction** | ltr in English, rtl in Arabic |
| **Priority** | P3 |

## Business Purpose

The platform's notice board. Platform staff author announcements at `/admin/announcements`; every
trade partner consumes them here. It is read-only for all four roles and is the post-login landing
page for Admin, Manufacturer and Distributor, which makes it the de-facto fallback route when
navigation fails. Pharmacy lands on `/scanning` instead.

## Roles

All four roles have `/information-center` in their sidebar and see **identical content** — audience
targeting on an announcement is "all users", not per-role. Verified live as Admin, Distributor and
Pharmacy on 2026-09-02.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Information Center | H2 heading | Page title |
| Urgent banner | Conditional region | Renders above everything when an announcement has `isUrgentBanner` |
| Pinned Announcements | Conditional H3 panel | Renders only when at least one announcement has `isPinned` |
| Latest Updates | H3 panel | The only panel with controls; lists all visible announcements |
| Search... | input[type=text] | Server-side, debounced. No maxlength, not required |
| All categories | p-select dropdown | 7 options, clearable. Placeholder is the "no filter" state |
| Upcoming Dates | H3 panel | Announcements carrying an `eventDate`, shown with that date |
| Guides and Resources | H3 panel | Categories `training` and `user_guides` |
| Support and Help | H3 panel | Category `system` |
| Announcement card | Clickable card | Opens a read-only detail dialog |
| Detail dialog | p-dialog | Title, category, Published and Effective timestamps, full body, close icon |
| AR / EN | Button `button.lang-toggle` | Switches language; label shows the *other* language |
| User chip | Clickable `main .user-name` | Opens the **Profile dialog**: Edit Name (Full Name, Save Changes) and Change Password (Current, New). Closes only via its X, not Escape |
| Header icon button | `button[title="Information Center"]` | Styled as interactive but has no observable effect (filed) |
| Empty state | Text | "No announcements found", rendered per panel |

Category options: Regulatory, System, Integration, Maintenance, Training, Deadlines, User Guides.

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Accept the production-access disclaimer.
4. Land on `/information-center`.
5. The page loads with the heading "Information Center" and its panels.
6. Enter a term in Search to narrow Latest Updates.
7. Select a category to narrow Latest Updates further.
8. Click an announcement card to open its detail dialog.

## Upstream workflow that fills this page

This page has no state of its own. Content arrives from the Administration module:

```
Admin creates announcement (/admin/announcements)   -> Draft
  -> submit (send icon)                             -> Pending Review
  -> approve (check icon)                           -> Published
  -> audience saved (Save Audience -> POST /targets) -> VISIBLE HERE
  -> archive (box icon)                             -> Archived
```

**A published announcement with no saved audience row is not visible here at all.** The audience is
a separate POST and is not written by the publish action. Statuses the platform recognises:
`draft`, `pending_review`, `approved`, `scheduled`, `published`, `expired`, `archived`.

## Edge Cases & Validation Rules

- **Search is server-side** and composes with the category filter:
  `?category=regulatory&search=paracetamol`. It matches Arabic body/summary content as well as
  English.
- **Neither filter is reflected in the URL**, so filter state is not deep-linkable and both reset on
  reload.
- **Filter state survives a language switch** — the selected category and the typed search term are
  both retained when toggling AR/EN.
- **Language is persisted** in `localStorage.lang` and survives reload.
- **Injection strings are handled as literals** — a SQL fragment or a `<script>` tag in Search
  returns the empty state with no error and no execution.
- **Role isolation** — a Pharmacy opening `/admin/announcements` by direct URL is redirected to its
  own landing page (`/scanning`); no admin data is exposed.
- **View counting** — opening a card's detail dialog increments that announcement's `viewCount`,
  visible in the admin table.

## API calls observed

Captured from the browser during discovery — nine GETs, all 200:

```
GET /masar-service/api/v1/users/me
GET /masar-service/api/v1/information-center/announcements/urgent
GET /masar-service/api/v1/information-center/announcements/pinned
GET /masar-service/api/v1/information-center/announcements
GET /masar-service/api/v1/information-center/announcements/upcoming-dates
GET /masar-service/api/v1/information-center/announcements?category=training
GET /masar-service/api/v1/information-center/announcements?category=user_guides
GET /masar-service/api/v1/information-center/announcements?category=integration
GET /masar-service/api/v1/information-center/announcements?category=system
```

On interaction: `?category=<selected>` and `?category=<selected>&search=<term>`.

## Notes

- Documented from live discovery against the devsim tenant on 2026-09-02, app version v1.0.2.
  UI elements above are what the page actually rendered, not a specification.
- The dashboard is bilingual and **defaults to Arabic**: a clean browser context with no stored
  preference loads `lang=ar` / `dir=rtl`. The choice is then held in `localStorage.lang`, so an
  automation profile that has switched to English once stays English. This page translates fully
  in both directions.
- Responses carry `x-ratelimit-limit: 2000`, so rate limiting is a testable surface.
