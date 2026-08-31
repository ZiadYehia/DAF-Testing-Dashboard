# Return Shipping — API Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Return Shipping |
| **Slug** | `api-return` |
| **Feature ID** | `EPTTS_API_08` |
| **Module** | EPTTS APIs |
| **Endpoint** | `POST /scp/SendEPCIS` |
| **Acting role** | Branch or Pharmacy |
| **Response mode** | Asynchronous — `202` then `MsgStatusQuery` |
| **Priority** | P2 |
| **Test cases** | 42 |

## Business Purpose

Sends stock back upstream: packs become **Returned** and travel toward the original shipper. Structurally shipping with `disposition: returned` plus a return reference, but the business rules differ — a return must trace back to the partner that originally supplied the pack, not to an arbitrary GLN.

## Request Contract

Standard EPCIS envelope (see the module overview for the full `@context` / `sbdh` wrapper)
posted to `POST /scp/SendEPCIS` with headers `apikey`, `Authorization: Bearer <token>`, and
`Content-Type: application/json` (or `application/xml` for the EPCIS 1.2 SOAP variant).

The `epcisBody.eventList` entry for this feature:

```json
{
  "type": "ObjectEvent",
  "eventTime": "<ISO 8601 with offset>",
  "eventTimeZoneOffset": "<+03:00>",
  "action": "OBSERVE",
  "bizStep": "shipping",
  "disposition": "returned",
  "epcList": ["<EPC URN>", "..."],
  "readPoint":   { "id": "<acting SGLN>" },
  "bizLocation": { "id": "<acting SGLN>" }
}
```

**Distinctive fields** — `sourceList`, `destinationList`, and a return reference in `bizTransactionList` (e.g. `RET-1001`)

**EPC carrier** — epcList: the EPCs being returned

## Happy Path

1. Authenticate: `POST /auth` with the role `apikey` header; capture `access_token`.
2. Build the EPCIS document: SBDH sender = the acting GLN, receiver = the counterparty GLN, and a fresh UUID as `instanceIdentifier`.
3. Submit: `POST /scp/SendEPCIS` with `apikey` + `Authorization: Bearer <token>` and `Content-Type: application/json`.
4. Receive **`202 Accepted`** — the submission is queued, not applied.
5. Poll `POST /MsgStatusQuery` with `{ "instanceIdentifier": "<the uuid>" }` until a terminal state.
6. Assert `SUCCESS`.
7. Confirm the resulting pack state with `POST /VerifyProduct` (and/or `GET /epcis` for the event record).

Final state: the packs become **Returned** / in transit to the upstream partner.

## Edge Cases & Validation Rules

### Specific to this feature

- Returning to a GLN that did not originally ship the pack.
- Returning a pack not in stock at the returner.
- Returning an already-returned or already-dispensed pack.
- Duplicate return reference; empty return reference.
- Return Cancel while the return is open (`bizStep` per the collection's Return Cancel request).
- Returning a destroyed pack.
- Partial return of an SSCC — some children only.

### Applies to every event feature

- **Synchronous vs asynchronous rejection are different behaviours.** A malformed request (missing mandatory field, empty `epcList`, bad `Content-Type`) is rejected `400` with *no* event queued and *no* `MsgStatusQuery` record. A well-formed request that fails a business rule returns `202` and `MsgStatusQuery` later returns `FAILED`. A case that asserts the wrong one of these will pass against broken behaviour.
- **GLN ownership** — acting on an EPC owned by another GLN must fail. This is the platform's most important authorization rule and needs explicit coverage here.
- **Role authorization** — a role not permitted this operation must be refused even with a valid key and a well-formed body.
- **Idempotency** — re-using an `instanceIdentifier` must not create a second event.
- **JSON and XML are separate code paths.** The EPCIS 1.2 SOAP/XML variant needs its own coverage, including an XXE attempt.
- **Identifier validation** — malformed SGTIN/SSCC/SGLN URNs, GLNs failing the GS1 check digit, and non-ISO-8601 timestamps must all be rejected.

## Notes

- Test data in the extracted cases still carries **staging-era GLNs** that do not match the production devsim tenant. See the module overview's re-mapping table.
- Executing this feature writes to **production**. Generated EPCs use run-scoped unique serials so repeated runs cannot collide.
- Recorded statuses in the test-case table are historical (from staging) and seed the Execution tab; nothing here has been executed against production yet.
