# Login Screen — Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Login / Sign In |
| **Slug** | `login` |
| **Module** | All authenticated roles |
| **Navigation Path** | Landing → Sign In |
| **Priority** | P1 |

## Business Purpose

Authenticates staff users. The role (Pharmacy / Branch / Distributor / Inspector) is determined server-side by the credentials entered — the UI adapts accordingly after login.

## Happy Path

1. On the landing screen, tap **Sign In**.
2. The login form appears (username/password fields).
3. Enter valid credentials for a role.
4. Tap **Login** / **Sign In**.
5. The app navigates to the home screen for that role.

## Edge Cases & Validation Rules

*(To be discovered through testing — e.g. wrong password, locked account, network error.)*

## Notes

*(To be updated as exploration continues.)*
