# Role / Tenant Security Test Matrix — EPTTS B2B API

Deliverable 1 of the QA & Security Testing Work Package. Enumerated live against
`https://192.168.225.195:8445/registry-service/api/v1/auth` on 2026-09-01 and cross-checked
against `data/eptts-api/modules/eptts-apis/knowledge/verified-live-contract.md`.

**Secrets are referenced by env key name only.** `data/` is committed to git; no API key,
password or token value appears in this file.

## Tenant

Only one tenant exists on this environment: **`devsim`**. There is no second tenant to test
horizontal cross-tenant isolation against. Every cross-tenant case in this feature is therefore
recorded `Blocked/Skipped` with that reason — never `Pass`. The work package's completion-gate
line "all tenants covered" is reported **not met on this environment**, not silently passed.

## Identities (B2B API)

Three B2B partner identities are provisioned, each with its own 64-char API key and a token
scoped to a distinct entity GLN. Confirmed by decoding each minted access token's claims.

| Role (token `role`) | Sheet name | entityGln | Entity | API key env | Dashboard login env |
|---|---|---|---|---|---|
| `manufacturer` | Manufacturer | `8435308300002` | INSTITUTO GRIFOLS, S.A. | `EPTTS_MFG_APIKEY` | `EPTTS_WEB_MFG_USERNAME` / `EPTTS_WEB_MFG_PASSWORD` |
| `distributor` | Branch | `0085412000008` | Baxter International Inc. | `EPTTS_BRANCH_APIKEY` | `EPTTS_BRANCH_PASSWORD` |
| `pharmacy` | Pharmacy | `1234567890128` | test pharmacy | `EPTTS_PHARMACY_APIKEY` | `EPTTS_WEB_PHARMACY_PASSWORD` |
| admin | Platform admin | `9999999999999` | Masar Platform Pilot | n/a (dashboard only) | `EPTTS_WEB_ADMIN_USERNAME` / `EPTTS_WEB_ADMIN_PASSWORD` |

Notes carried from the verified contract:
- The platform has **no `branch`-role users**; "Branch" behaviour is carried by the `distributor`
  role. Cases written "Authenticated as Branch" map to `distributor`.
- `EPTTS_INTEGRATOR_APIKEY` is **not provisioned** on this environment, so the integrator role is
  out of scope for the matrix here.
- The B2B token is **HS256**-signed and carries
  `{ sub, role, entityId, entityGln, jti, source: "b2b", principalType: "b2b_partner", iat, exp }`,
  lifetime **900 s**. The refresh token carries only `{ sub, iat, exp }`, ~7-day lifetime.
- Dashboard auth is **separate** (Keycloak OIDC, realm `masar`, client `masar-dashboard`); its
  credentials are refused by the B2B `/auth` endpoint and vice-versa.

## Role-by-operation guard matrix (verified per role)

`403` = role denied · `400` = role allowed, body validation rejected · `200`/`202` = accepted.
Rows from the verified live contract; this feature re-executes them as security assertions.

| Operation | manufacturer | distributor | pharmacy |
|---|---|---|---|
| `POST /scp/SendEPCIS` | 400 | 400 | 400 |
| `POST /epcis/json` | 400 | 400 | 400 |
| `POST /MsgStatusQuery` | 400 | 400 | 400 |
| `POST /VerifyProduct` | 200 | 200 | 200 |
| `POST /Dispensation` | **403** | 400 | 400 |
| `GET /epcis` | 200 | 200 | 200 |
| `GET /scp/invoices` | **403** | 200 | 200 |

The `403` body names the permitted roles verbatim, which makes the negative assertion precise:

> `Access denied. This endpoint is available to: Pharmacy, SCP branch, SCP, Daf admin, B2B user, pharmacy_admin.`

## Object-ownership controls (what the matrix cannot show)

Guarding an *endpoint* by role is not the same as guarding an *object* by owner. These are the
BOLA/BFLA (OWASP API1/API5) cases this feature adds on top of the role matrix:

- SBDH sender-GLN spoofing → verified `403 "Sender GLN does not match authenticated user entity"`.
- A body `entityGln`/owner that differs from the token's claim (protected-property injection).
- Requesting another entity's SGTIN / SSCC / invoice / instanceIdentifier.
- **Product ownership**: the LoadTesting suite recorded on cloud staging that a MAH could commission
  a product it does not own and another distributor's branch could ship it. This feature
  **re-confirms that on devsim** — if it reproduces it is a Critical (P1) authorization finding.
