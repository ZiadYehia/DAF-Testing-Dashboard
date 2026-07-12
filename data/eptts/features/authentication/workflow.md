# Authentication & Activation Module — Workflow

---

## Feature Details

| Field | Value |
|-------|-------|
| Feature IDs | EPTTS_FR_01, EPTTS_FR_02, EPTTS_FR_03, EPTTS_FR_04, EPTTS_FR_05, EPTTS_FR_06 |
| Module Path | App Launch → Login → OTP → Activation Key → Main Screen |
| User | Pharmacy User |
| Priority | P1 |
| App Version | v2.3.5 |
| Screenshots | `screenshots/Auth_login.jpg`, `screenshots/Auth_otp.jpg` |

---

## Business Purpose

Securely authenticate pharmacy users and bind the Agent installation to a specific pharmacy and GLN context before allowing any transaction operations.

---

## Screens & UI Elements

### Screen 1 — Login
- App title: **EPTTS** / Subtitle: **Pharmacy Companion** / Version: v2.3.5
- Field: **Email** (placeholder: `your@pharmacy.com`)
- Field: **Password** (masked, eye icon toggles visibility)
- Collapsible section: **▼ Advanced**
  - Field: **Server URL** (pre-filled by company: `https://masar-api.v2.daf-holding.com`; can be changed if needed)
- Button: **Sign In**

### Screen 2 — OTP Verification
- App title: **EPTTS** / Subtitle: **Verify Your Identity**
- Message: `A 6-digit code was sent to your email {email}`
- 6 individual digit input boxes
- Button: **Verify**
- Link: **Resend Code**
- Link: **Back to Login**

### Screen 3 — Activation Key *(currently disabled)*
- Validates that this device is authorized for this pharmacy/GLN
- One-time key generated per pharmacy, has an expiration date
- Same key cannot be used on multiple devices simultaneously

### Post-Login — Main Screen
- Mode buttons loaded: SELL / RECEIVE / RETURN / RTN BRANCH
- Sync status: `✓ All synced`
- Pharmacy name, Email, and Location ID (GLN) visible in Settings → Overview

---

## User Flow — Happy Path

1. User launches the EPTTS application on Windows.
2. Login screen appears showing the EPTTS logo, Email field, Password field, and Advanced section with pre-filled Server URL.
3. User enters their pharmacy **Email** address.
4. User enters their **Password**.
5. *(Optional)* User expands **▼ Advanced** to verify or change the Server URL if needed.
6. User clicks **Sign In**.
7. Application sends credentials to the server; OTP screen appears.
8. OTP screen displays: "A 6-digit code was sent to your email {user_email}".
9. User opens their email, retrieves the 6-digit OTP code.
10. User enters the code into the 6 digit boxes (one character per box).
11. User clicks **Verify**.
12. *(Activation Key — currently disabled; when enabled):* App prompts for the activation key; user enters the one-time key provided by the company for this pharmacy/GLN.
13. Application validates the key, links the device to the pharmacy context, and loads the main screen.
14. Main screen appears with mode buttons (SELL, RECEIVE, RETURN, RTN BRANCH); pharmacy name and GLN are now active.

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Submit form (Sign In / Verify) | Enter |
| Navigate between OTP digit boxes | Tab / Arrow keys |

---

## Validation Rules

| Rule | Behavior |
|------|----------|
| Email field empty | Sign In blocked; validation message shown |
| Password field empty | Sign In blocked; validation message shown |
| Invalid credentials (wrong email or password) | Error message displayed; user stays on Login screen |
| Wrong OTP code | Error message; user stays on OTP screen |
| OTP expired | Error message; user can click Resend Code to get a new OTP |
| Activation key already used | Error: key already used or expired |
| Activation key expired | Error: key expired |
| Same activation key used on a second device | Error: key already linked to another device |
| Server URL unreachable | Network error displayed; Sign In is blocked |

---

## State Transitions

```
Unauthenticated
  → (valid email + password) → OTP Pending
  → (valid OTP) → Activation Key Required (disabled) / Authenticated
  → (valid activation key) → Authenticated + Device Linked to pharmacy GLN
```

---

## Edge Cases

- **OTP auto-fill**: OS or email client may suggest OTP — verify the digit boxes accept pasted/autofilled values correctly.
- **Resend Code**: Second OTP invalidates the first; first code must be rejected after resend.
- **Network disconnect during login**: Error shown at Sign In; retry works after reconnect.
- **Network disconnect during OTP entry**: Error shown at Verify; retry works after reconnect.
- **Back to Login**: Clicking "Back to Login" from OTP screen returns to Login cleanly without retaining entered data.
- **Password visibility toggle**: Eye icon shows/hides the password field.
- **Server URL change**: Invalid URL must fail gracefully with a clear error.

---

## Known Defects

- **Session lost after restart**: App re-prompts for login and activation key after reopening, even when a valid session exists.
- **Deactivation does not force logout**: If the pharmacy is deactivated or the device is unlinked from the Masar backend, the Agent continues operating instead of forcing logout and blocking transactions.

---

## Integration Points

- **Masar backend**: Credential validation, OTP dispatch (via email), activation key validation.
- **Device context**: After activation, the device is bound to a specific pharmacy GLN — all subsequent transactions use this GLN.
