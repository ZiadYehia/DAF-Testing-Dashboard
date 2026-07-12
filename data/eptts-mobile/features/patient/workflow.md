# Patient — Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Patient Pack Validation |
| **Slug** | `patient` |
| **Module** | Patient (public — no login required) |
| **Navigation Path** | Landing → Patient |
| **Priority** | P1 |

## Business Purpose

Allows any patient / member of the public to verify that a pharmaceutical product pack is legitimate and track its chain of custody, without needing an account. The patient taps "Patient" on the landing screen and scans or enters the pack barcode to validate it.

## UI Elements

| Element | Class | Content-Desc | Clickable | Notes |
|---------|-------|--------------|-----------|-------|
| Header title | `android.view.View` | `Patient` | false | Label only |
| Subtitle | `android.view.View` | `Verify your medication` | false | Label only |
| Validate Pack tile | `android.view.View` (parent) | *(none on clickable parent)* | **true** | Child `android.view.View` has `content-desc="Validate Pack"`. Tap child → event propagates to parent |
| Back tile | `android.view.View` | `Back` | **true** | — |

### Validate Pack Scanner Screen

| Element | Class | Content-Desc | Clickable | Notes |
|---------|-------|--------------|-----------|-------|
| Back button | `android.widget.Button` | `Back` | **true** | Has `tooltip-text="Back"` |
| Page title | `android.view.View` | `Validate Pack` | false | heading=true |
| Scan circle | `android.view.View` | *(none)* | **true** | No content-desc; use coordinate tap or UiAutomator |
| Scan label | `android.view.View` | `Tap to scan GTIN / SGTIN` | false | Label below scan circle |

## Happy Path

1. On the landing screen tap **Patient**.
2. Patient home screen appears with a single **Validate Pack** tile.
3. Tap **Validate Pack**.
4. The barcode scanner view opens (camera preview + scan frame).
5. Point the camera at a GS1/SGTIN barcode on a medicine pack.
6. The app reads the barcode and displays validation results (pack authenticity, supply chain status).
7. Patient taps back to return to the home screen.

## Edge Cases & Validation Rules

- Scanning an unrecognised barcode should display an appropriate error message.
- No network / server unreachable: graceful offline error state expected.
- No camera permission: app should request permission; if denied, a fallback message should appear.
- Manual entry alternative (if supported): user types a serial number/SGTIN instead of scanning.

## Notes

- This is the only public-facing flow in the app — no authentication required.
- The "Patient" button on the landing screen bypasses Keycloak SSO entirely.
