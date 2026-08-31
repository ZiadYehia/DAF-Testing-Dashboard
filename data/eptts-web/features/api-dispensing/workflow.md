# Dispensing — API Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Dispensing |
| **Slug** | `api-dispensing` |
| **Feature ID** | `EPTTS_API_10` |
| **Module** | EPTTS APIs |
| **Endpoint** | `POST /Dispensation` |
| **Acting role** | Pharmacy (or POS Integrator acting on its behalf) |
| **Response mode** | Asynchronous — `202` then `MsgStatusQuery` |
| **Priority** | P1 |
| **Test cases** | 33 |

## Business Purpose

The terminal event of the supply chain: a pharmacy dispenses a pack to a patient and it leaves circulation as **Dispensed**. The source spreadsheet and the vendor collection both describe this endpoint as **synchronous (`200`)**. Verified live, that is wrong: it returns **`202` + `I001`** and must be polled through `MsgStatusQuery` like every other write. A test asserting `200` here fails against the real platform.

## Request Contract

Standard EPCIS envelope (see the module overview for the full `@context` / `sbdh` wrapper)
posted to `POST /Dispensation` with headers `apikey`, `Authorization: Bearer <token>`, and
`Content-Type: application/json` (or `application/xml` for the EPCIS 1.2 SOAP variant).

The `epcisBody.eventList` entry for this feature:

```json
{
  "type": "ObjectEvent",
  "eventTime": "<ISO 8601 with offset>",
  "eventTimeZoneOffset": "<+03:00>",
  "action": "OBSERVE",
  "bizStep": "retail_selling",
  "disposition": "retail_sold",
  "epcList": ["<EPC URN>", "..."],
  "readPoint":   { "id": "<acting SGLN>" },
  "bizLocation": { "id": "<acting SGLN>" }
}
```

**EPC carrier** — epcList: the SGTINs being dispensed

## Happy Path

1. Authenticate: `POST /auth` with the role `apikey` header; capture `access_token`.
2. Build the EPCIS document: SBDH sender = the acting GLN, receiver = the counterparty GLN, and a fresh UUID as `instanceIdentifier`.
3. Submit: `POST /scp/SendEPCIS` with `apikey` + `Authorization: Bearer <token>` and `Content-Type: application/json`.
4. Receive **`202 Accepted`** — the submission is queued, not applied.
5. Poll `POST /MsgStatusQuery` with `{ "instanceIdentifier": "<the uuid>" }` until a terminal state.
6. Assert `SUCCESS`.
7. Confirm the resulting pack state with `POST /VerifyProduct` (and/or `GET /epcis` for the event record).

Final state: each pack becomes **Dispensed** and leaves pharmacy inventory.

## Edge Cases & Validation Rules

### Specific to this feature

- Dispensing a pack not in this pharmacy's inventory.
- Dispensing an already-dispensed pack.
- Dispensing a destroyed, recalled, or expired pack.
- Dispensing a pack still in transit.
- Dispensing an SSCC rather than an SGTIN.
- Dispense Cancel — reverses a dispensation; confirm the pack returns to **In stock** and can be dispensed again.
- A POS Integrator dispensing with a mismatched `actingOnBehalfOfGln`.
- Empty `epcList`; duplicate SGTINs in one request.

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
