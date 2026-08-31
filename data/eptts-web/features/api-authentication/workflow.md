# Authentication — API Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Authentication |
| **Slug** | `api-authentication` |
| **Feature ID** | `EPTTS_API_01` |
| **Module** | EPTTS APIs |
| **Endpoint** | `POST /auth` |
| **Response mode** | Asynchronous — `202` then `MsgStatusQuery` |
| **Priority** | P1 |
| **Test cases** | 13 |

## Business Purpose

Exchanges a role API key for a bearer token. Every other endpoint in this module depends on it, so a break here fails the entire suite. The API key identifies *which trade partner* the caller is acting as, making this both the authentication and the tenant-selection boundary.

## Request Contract

```http
POST /auth
apikey: <role API key>

-> 200 { "access_token": "<jwt>" }
```

## Happy Path

1. Send `POST /auth` with a valid role `apikey` header.
2. Receive `200` and an `access_token` in the body.
3. Use that token as `Authorization: Bearer <token>` on a subsequent request and confirm it is accepted.

## Edge Cases & Validation Rules

### Specific to this feature

- **The username/password flow in the source spreadsheet no longer exists.** `POST /auth` returns `401` for an empty body, i.e. it rejects on the `apikey` header before reading the body. `TC_AUTH_004`–`TC_AUTH_013` were written against username/password and are all `Blocked/Skipped` with the note *"In new version, it depends only on apikey."*
- Missing `apikey` header entirely.
- Malformed / random `apikey` value.
- Revoked or rotated `apikey`.
- Expired `apikey`.
- A key belonging to a different tenant — must not grant access to this tenant's data.
- Token expiry: a token past its lifetime must be refused by downstream endpoints with `401`, not silently accepted.
- Token scope: a manufacturer token must not authorize pharmacy-only operations.

### Applies to every event feature

- **Synchronous vs asynchronous rejection are different behaviours.** A malformed request (missing mandatory field, empty `epcList`, bad `Content-Type`) is rejected `400` with *no* event queued and *no* `MsgStatusQuery` record. A well-formed request that fails a business rule returns `202` and `MsgStatusQuery` later returns `FAILED`. A case that asserts the wrong one of these will pass against broken behaviour.
- **GLN ownership** — acting on an EPC owned by another GLN must fail. This is the platform's most important authorization rule and needs explicit coverage here.
- **Role authorization** — a role not permitted this operation must be refused even with a valid key and a well-formed body.
- **Idempotency** — re-using an `instanceIdentifier` must not create a second event.
- **JSON and XML are separate code paths.** The EPCIS 1.2 SOAP/XML variant needs its own coverage, including an XXE attempt.
- **Identifier validation** — malformed SGTIN/SSCC/SGLN URNs, GLNs failing the GS1 check digit, and non-ISO-8601 timestamps must all be rejected.

## Notes

- Two candidate auth URLs were both reachable (`401`) during recon: `:8445/registry-service/api/v1/auth` (the URL supplied for production) and `:8444/masar-service/api/v1/auth` (the Postman collection's). **Which is canonical must be confirmed live before the specs are finalised.**
- The 9 blocked cases need re-authoring around apikey-only semantics. Their IDs are retained so the spreadsheet still maps 1:1.
- Test data in the extracted cases still carries **staging-era GLNs** that do not match the production devsim tenant. See the module overview's re-mapping table.
- Executing this feature writes to **production**. Generated EPCs use run-scoped unique serials so repeated runs cannot collide.
- Recorded statuses in the test-case table are historical (from staging) and seed the Execution tab; nothing here has been executed against production yet.
