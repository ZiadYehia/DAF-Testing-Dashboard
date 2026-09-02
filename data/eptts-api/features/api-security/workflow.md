# Security — API Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Security |
| **Slug** | `api-security` |
| **Feature ID** | `EPTTS_API_12` |
| **Module** | EPTTS APIs |
| **Endpoint** | cross-cutting — `/auth`, `/scp/SendEPCIS`, `/epcis/json`, `/VerifyProduct`, `/Dispensation`, `/MsgStatusQuery`, `/scp/invoices`, `GET /epcis` |
| **Response mode** | mixed — synchronous auth/authz/validation, asynchronous submit-and-poll for lifecycle |
| **Priority** | P1 |
| **Test cases** | 48 |

## Business Purpose

This feature is the security cross-cut of the EPTTS B2B API, mapping the six control areas of the
QA & Security Testing Work Package onto the verified live contract. Where the other eleven features
verify that the supply chain *functions*, this one verifies that it *refuses* what it must:
forged and expired tokens, operations outside a role's authority, another entity's objects,
out-of-order lifecycle events, hostile payloads, and error responses that leak internal detail.

It baselines against OWASP ASVS 5, API Security Top 10 (notably API1 BOLA, API3 property-level
authorization, API5 BFLA, API8 security misconfiguration) and WSTG.

## Request Contract

Each case targets whichever endpoint exercises the control under test; there is no single request
shape. The auth contract it builds on:

```http
POST :8445/registry-service/api/v1/auth
apikey: <64-char B2B key>
-> 200 { "access_token": "<HS256 jwt>", "expires_in": 900 }

Authorization: Bearer <jwt>   # authoritative on every masar-service endpoint; apikey alone -> 401
```

## Happy Path

The "happy path" for a security feature is a correct refusal. A representative pass:

1. Mint a valid token, then edit its payload claims and keep the original signature.
2. Send the tampered token as `Authorization: Bearer` to `POST /VerifyProduct`.
3. The platform rejects it with `401` and issues no data.

## Edge Cases & Validation Rules

### The six control areas

1. **Authentication & session** (`TC_SEC_001`–`010`) — token forgery (`alg:none`, tampered claims,
   stripped/garbage signature), expiry, missing/garbage bearer, `apikey`-only rejection, refresh
   token not usable as an access token, and per-role claim binding.
2. **Authorization & entity isolation** (`TC_SEC_011`–`020`, `046`–`048`) — the role-by-operation
   matrix executed as assertions, object-ownership (BOLA/BFLA), protected-property injection, and
   genuine cross-entity isolation using a **second, independent entity of each role** (the `EF` set):
   a foreign entity cannot ship/receive/dispense a pack it does not own, cannot commission under
   another manufacturer's GS1 prefix, and sees only its own event/invoice history.
3. **Lifecycle & workflow** (`TC_SEC_021`–`026`) — invalid transition ordering, duplicate
   `instanceIdentifier` exactly-once, replay, and the refused `dispensed → dispensed` transition.
4. **Input, payload & file** (`TC_SEC_027`–`036`) — malformed/oversized JSON and EPCIS XML, XXE,
   billion-laughs, injection/XSS in free-text fields, the `lotNumber` length leak, and re-querying
   to prove rejected input is not stored.
5. **Rate, admission & async** (`TC_SEC_037`–`040`) — assertion-only: rate-limit headers present and
   decrementing, `429` carries `Retry-After`, and `202`-then-registers. No load is generated here;
   throughput is evidenced by the separate k6 suite (see `knowledge.md`).
6. **Transport & disclosure** (`TC_SEC_041`–`045`) — HSTS / CSP / `X-Content-Type-Options` /
   `X-Frame-Options` present, no version banner, and error bodies free of stack traces, SQL text and
   internal hostnames.

### Applies to every event feature

- Asynchronous endpoints must assert the whole chain (`202`/`200` → `MsgStatusQuery` terminal →
  resulting `pack.status`), never just the acknowledgement.
- Negative assertions must match the endpoint's error envelope — three formats coexist
  (structured EPCIS `statustype:E`, `logList`, and NestJS default).

## Notes

- **Isolation boundary is the entity, not a tenant.** The B2B token carries no tenant claim, so the
  API isolates by entity. Horizontal isolation is tested with a second independent entity of each
  role (the `EF` accounts, added 2026-09-02), not a second tenant.
- **Rate limiting is header-verified, not load-tested here.** Progressive-burst / saturation
  behaviour was measured by the `LoadTesting` k6 suite on a different environment (cloud staging
  behind Cloudflare); this feature cites that evidence rather than re-generating load against the
  shared devsim platform.
- **Known-gap convention applies.** Where the platform is wrong (e.g. an empty `eventList` is
  accepted), the case asserts the *correct* behaviour and carries `expectFail`, so a fix surfaces as
  a loud unexpected pass. See `data/eptts-api/knowledge/testcase-writing-rules.md`.
