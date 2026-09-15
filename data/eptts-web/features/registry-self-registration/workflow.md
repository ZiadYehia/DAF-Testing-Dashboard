# Self-Registration (Track & Trace Entities Registration)

Documented from live discovery against production devsim on 2026-09-09. Everything below is what
the surface actually did, not a specification.

## What it is, and what it is not

`https://192.168.225.195:8445/onboarding` is **unauthenticated** and reachable without a Keycloak
session — it is the only EPTTS surface that is. It is titled "EPTTS — Track & Trace Entities
Registration".

It is **not** open self-registration. Keycloak realm self-registration is disabled (the login page
carries no `#kc-registration` link), and this page does not create an identity from nothing:
it authenticates the applicant against their **existing EDA Company Profile** and then collects the
Track & Trace-specific data EDA does not hold. So the correct description is *assisted onboarding
for a company EDA already knows*, and a company with no EDA Company Profile cannot start here.

## Step 1 — entity type

Six buttons, each with a one-line explanation:

| Button | Sub-text |
|---|---|
| Factory | Manufactures its own products. |
| Toll | Manufactures on behalf of another company. |
| Importer | Imports already-manufactured products. |
| Distributor | Distributes products to the market. |
| Wholesaler | Sells products wholesale. |
| Warehouse | Stores and handles products. |

The choice is sent as `entityType` on the session call and decides the rest of the flow: only
product-bearing types get the Products step (`unlockedTabs.products`).

## Step 2 — EDA Company Profile login

Heading "Company Profile Login", body "Log in with your EDA Company Profile credentials. —
&lt;entity type&gt;". Two fields, `#tnt-username` ("Company Profile ID") and `#tnt-password`
("Company Profile Password"), plus `Back` and `Login`.

`POST /registry-service/api/v1/onboarding/registration/session` with
`{entityType, username, password}` answers **201** and returns a **bearer JWT** — `aud:
tnt-registration`, `sub` the EDA username, `regId` the registration id, one hour expiry — along
with `status`, `unlockedTabs` and the company block. The registration is a resumable **draft**:
logging in again returns the same `regId` rather than starting over.

## Step 3 — Company Data

`GET /onboarding/registration/me` returns the whole registration. Two blocks on screen.

**COMPANY MAIN DATA — "From EDA Company Profile — read only".** Name EN/AR, address EN/AR, licence
number, tax number. These are rendered from the EDA profile and cannot be edited; where EDA holds
nothing the field shows "Not provided by EDA — please contact EDA to update your profile."
**The company being registered is therefore whichever company the credentials belong to** — there
is no field in which to name a different one.

Editable, all of them mandatory server-side and none marked `required` in the DOM:

| Field | id | Rule, from the bundle | Message on failure |
|---|---|---|---|
| Company GLN | `tnt-gln` | `/^\d{13}$/` | GLN must be exactly 13 digits. |
| Company GCP | `tnt-gcp` | `/^\d{4,12}$/` | GCP is required (4–12 digits). |
| Governorate | `tnt-gov` | 27 governorates, each with an `areaCode` | — |
| District | `tnt-dist` | must be non-zero; options depend on the governorate | This field is required. |
| Focal point name EN / AR | `tnt-fp-name-en` / `-ar` | both non-empty | This field is required. |
| Focal point e-mail / phone | `tnt-fp-email` / `tnt-fp-phone` | both non-empty | This field is required. |
| National ID | `tnt-fp-nid` | `/^\d{14}$/` | National ID Number must be exactly 14 digits. |
| National ID expiry | `tnt-fp-nid-exp` | `/^(0[1-9]|1[0-2])\/\d{4}$/` | Expiry date must be in MM/YYYY format. |
| Job title EN / AR | `tnt-fp-title-en` / `-ar` | both non-empty | This field is required. |

`#tnt-save` ("Verify & Continue") validates in that order and stops at the first failure, so a
form with several gaps reports them one at a time. Only once all pass does it
`PUT /onboarding/registration/company`.

The page also warns: *"Your Company GLN/GCP will be validated against the GS1 registry. You will
not be able to proceed until this succeeds."* That validation happens server-side on the PUT, not
in the browser.

## Endpoints (read from `/assets/boot-DXlc52c7.js`)

All under `https://192.168.225.195:8445/registry-service/api/v1`, all bearing the
`tnt-registration` JWT rather than a Keycloak token:

```
POST   /onboarding/registration/session              {entityType, username, password} -> 201 + token
GET    /onboarding/registration/me
PUT    /onboarding/registration/company
GET    /onboarding/registration/products
PUT    /onboarding/registration/products/{id}
POST   /onboarding/registration/products/{id}/clone  {gtin}
DELETE /onboarding/registration/products/{id}
GET    /onboarding/registration/readiness
PUT    /onboarding/registration/readiness/factory
PUT    /onboarding/registration/readiness/company
PUT    /onboarding/registration/warehouses/{id}
POST   /onboarding/registration/submit               {newPassword, newPasswordConfirm}
GET    /onboarding/registration/reference/governorates
GET    /onboarding/registration/reference/districts
```

The stepper is `login → company → products → readiness`, and **`submit` sets the new account's
password** — so completing a registration mints a platform credential and is not repeatable
against the same profile.

## Notes for anyone automating this

- **Errors are transient toasts.** Validation failures appear as `div.toast.error` and are removed
  again shortly afterwards. Reading the DOM a few seconds after clicking finds nothing, which looks
  exactly like an inert button — an enabled `#tnt-save` that issues no request and shows no
  message. It is not inert; observe the mutation, do not sample it. This cost a nearly-filed P1.
- Inputs are bound with `addEventListener('input')`, so a value set without dispatching `input`
  never reaches the model and the form validates as empty.
- The draft persists between sessions, so a rerun resumes rather than starting clean; a case that
  needs a fresh draft has no control to create one.
