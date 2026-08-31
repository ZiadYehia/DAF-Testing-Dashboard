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
| lang-switch | select | options: English, العربية |
| rp-gln | input | 13 digits |
| rp-prefix | input | 4–12 digits |
| rp-name | input | — |
| rp-name-ar | input | — |
| rp-popular | input | signboard name (optional) |
| rp-popular-ar | input | اسم اللافتة (اختياري) |
| rp-area | select | options: — select — |
| rp-governorate | select | options: — select —, Alexandria — الإسكندرية, Aswan — أسوان, Asyut — أسيوط, Beheira — البحيرة, Beni Suef — بني سويف, Cairo — القاهرة, Dakahlia — الدقهلية |
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
