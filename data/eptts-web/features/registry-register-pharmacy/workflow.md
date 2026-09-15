# Register Pharmacy — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Register Pharmacy |
| **Slug** | `registry-register-pharmacy` |
| **Feature ID** | `EPTTS_REG_05` |
| **Module** | Master Data Registry |
| **Portal** | https://192.168.225.195:8445 |
| **Route** | `Register Pharmacy` |
| **Text direction** | ltr |
| **Priority** | P2 |

## Business Purpose

Pharmacy onboarding form - the widest input surface in the product (25 fields), which makes it the highest-value target for mandatory-field and format validation testing.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Master Data Registry | Heading | — |
| Register New Pharmacy DISPENSER | Heading | — |
| ☰ | Button / action | — |
| 🏢 Parties (50+) | Button / action | — |
| 🔢 Prefixes (50+) | Button / action | — |
| 📦 Products (50+) | Button / action | — |
| ➕ Register Pharmacy | Button / action | — |
| Logout | Button / action | — |
| 🔄 Refresh | Button / action | — |
| ⏳ Sync mirror | Button / action | — |
| ⬆️ Bulk upload (JSON) | Button / action | — |
| ✅ Activate All | Button / action | — |
| 📍 Use my current location | Button / action | — |
| Cancel | Button / action | — |
| Register pharmacy | Button / action | — |
| lang-switch | select | options: English, Arabic |
| rp-gln | input | 13 digits |
| rp-prefix | input | 4–12 digits |
| rp-name | input | — |
| rp-name-ar | input | — |
| rp-popular | input | signboard name (optional) |
| rp-popular-ar | input | Signage name in Arabic (optional) |
| rp-area | select | options: — select — |
| rp-governorate | select | options: — select —, Alexandria, Aswan, Asyut, Beheira, Beni Suef, Cairo, Dakahlia|
| rp-district | select | options: — select — |
| rp-phone | input | — |
| rp-address | textarea | — |
| rp-address-ar | textarea | — |
| rp-taxid | input | — |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8445.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Click **Register Pharmacy** in the portal navigation.
4. The page loads with the heading "Register Pharmacy".

## Edge Cases & Validation Rules

- **Role isolation** — a role without access must be refused on direct URL entry, not merely have the menu entry hidden.
- **Session expiry** — an expired Keycloak session must redirect to login, never display stale data.
- **Backend failure** — a failing API call must surface an error state, not render empty data as a valid result.

## API calls observed

Captured from the browser during discovery — these are the endpoints this page depends on:

```
GET /registry-service/api/v1/geography/areas
GET /registry-service/api/v1/admin/mdm/products?limit=50
GET /registry-service/api/v1/geography/governorates
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases are all `new_added` — none has been executed yet.

## Re-documented 2026-09-09 (as the INSPECTOR)

### The form has 24 fields, not 13, and it issues the credentials itself

The UI Elements table above lists 13 `rp-*` fields. The live form has 24, and the extra ones are
the important ones — they mean a pharmacy's LOGIN and its API KEY are created by this single
submission, rather than afterwards through Parties as the feature's knowledge previously assumed:

| id | type | note |
|---|---|---|
| `rp-tax`, `rp-cr` | input | tax and commercial-registration numbers |
| `rp-spoc-name`, `rp-spoc-name-ar` | input | single point of contact |
| `rp-contact-role` | select | contact's role |
| `rp-spoc-phone`, `rp-spoc-email` | input | contact details |
| **`rp-gen-account`** | checkbox | **generate a login account for the pharmacy** |
| `rp-user-email` | input[email] | the account's username |
| `rp-user-pw` | input[password] | placeholder "leave blank to auto-generate" |
| **`rp-gen-key`** | checkbox | **generate a B2B API key** |

Button ids: `rp-submit` ("Register pharmacy"), `rp-cancel`, `rp-locate`
("📍 Use my current location").

**No field carries `required`.** Every one reports `required: false`, so mandatory-field
enforcement is server-side or script-driven rather than HTML5 — a validation case must submit and
read the response, not rely on the browser refusing.

`rp-gln` is `maxlength=13` and `rp-prefix` is `maxlength=12`, but neither has a `pattern`, so
non-numeric input is not blocked at the input layer.

### The inspector is MEANT to onboard pharmacies — the page says so

Logged in as `inspector@masar.local` (role `inspector`, GLN 9999999999999, entity "Masar Platform
Pilot"), the registry portal renders five nav entries — Dashboard, Parties, Prefixes, Products and
**➕ Register Pharmacy** — and the page offers **+ Add Party**, **👥 Accounts** and **🔑 B2B Key**.
The Register Pharmacy form is fully enabled.

This is intended, and the page states it outright:

> Inspectors can onboard a new pharmacy here (a Dispenser party). All required fields marked *.
> **Backend enforces ADMIN/INSPECTOR role.**

Worth recording because the obvious inference is wrong. `eptts-mobile`'s domain knowledge defines
inspector as "Read-only regulatory/government auditor role … cannot create, modify, accept,
reject, or delete", and a bug was briefly filed here on the strength of that. It was retracted:
that definition describes the MOBILE inspector, a different surface, and the registry portal
deliberately grants the role write access to onboarding. Two roles share a name across two apps
and do not share a permission set.

The admin sees a sixth nav entry, **⚙️ Administration**, which the inspector does not — so the
role is not an admin alias either.

### Required fields

The form marks these with `*`: **GLN**, **Pharmacy name**, **Governorate**, **Phone**,
**Address**. Everything else — GS1 company prefix, popular names, Arabic names, area, district,
tax id, commercial registration, the SPOC block — is optional. None of them carry the HTML
`required` attribute, so the enforcement is the backend's.
