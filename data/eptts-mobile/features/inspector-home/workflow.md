# Inspector Home — Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Inspector Home |
| **Slug** | `inspector-home` |
| **Module** | Inspector |
| **Navigation Path** | Landing → Sign In (inspector credentials) → Home |
| **Priority** | P1 |

## Business Purpose

The home screen for the Inspector role. Inspectors are regulatory/government auditors who monitor pharmaceutical supply-chain integrity. The home tile grid provides access to all inspector capabilities.

## UI Elements (Verified 2026-07-09)

| Element | Class | Content-Desc | Clickable | Notes |
|---------|-------|--------------|-----------|-------|
| Header | `android.view.View` | `Hello\nSystem Admin Entity` | false | Multiline; entity name is the Keycloak account name |
| View Shipments tile | `android.view.View` (child) | `View Shipments` | false | Parent is clickable; tap propagates |
| Trace tile | `android.view.View` (child) | `Trace` | false | Parent is clickable |
| Delete Account tile | `android.view.View` (child) | `Delete Account` | false | Parent is clickable |
| Logout tile | `android.view.View` (child) | `Logout` | false | Parent is clickable |

## Logout Dialog UI Elements

| Element | Content-Desc | Clickable | Notes |
|---------|--------------|-----------|-------|
| Dialog title | `Logout` | false | Heading |
| Dialog body | `Are you sure you want to logout?` | false | Detect dialog presence by this |
| Cancel button | `Cancel` | true | |
| Confirm button | `Logout` | true | Same content-desc as the home tile — dialog takes precedence when open |
| Dismiss | `Dismiss` | true | Gesture dismiss overlay |

## Happy Path

1. User authenticates with inspector credentials (`testinspector@eptts.com`).
2. Inspector home screen appears with **4 tiles** in a 2×2 grid:
   - **View Shipments** (top-left)
   - **Trace** (top-right)
   - **Delete Account** (bottom-left)
   - **Logout** (bottom-right)
3. User taps any tile to navigate to that feature.

## Logout Flow

1. Tap the **Logout** tile.
2. A confirmation dialog appears: "Are you sure you want to logout?" with **Cancel** and **Confirm** buttons.
3. Tapping **Confirm** logs the user out and returns to the landing screen.
4. Tapping **Cancel** dismisses the dialog and keeps the user on the home screen.

## Edge Cases & Validation Rules

- Tapping **Delete Account** should prompt a warning dialog before irreversible action.
- Session expiry: the app should detect an expired token and redirect to the landing screen.

## Notes

- Inspector is a read-only auditor role — no pack manipulation actions.
- The role exposes fewer features than Distributor, Branch, or Pharmacy roles.
