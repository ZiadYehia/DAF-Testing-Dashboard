# Return Receiving — API Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Return Receiving |
| **Slug** | `api-return-receiving` |
| **Feature ID** | `EPTTS_API_09` |
| **Module** | EPTTS APIs |
| **Endpoint** | `POST /scp/SendEPCIS` |
| **Acting role** | Manufacturer or Branch |
| **Response mode** | Asynchronous — `202` then `MsgStatusQuery` |
| **Priority** | P2 |
| **Test cases** | 40 |

## Business Purpose

Closes the reverse-logistics loop: the upstream partner accepts returned stock and the packs become **Available** again. The only transition that moves packs *out of* a terminal-looking state back into sellable inventory, so it is the one place where a bug can silently resurrect stock that should not be re-sold.

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
  "bizStep": "receiving",
  "disposition": "returned",
  "epcList": ["<EPC URN>", "..."],
  "readPoint":   { "id": "<acting SGLN>" },
  "bizLocation": { "id": "<acting SGLN>" }
}
```

**Distinctive fields** — `sourceList` (the returner) and the return reference in `bizTransactionList`

**EPC carrier** — epcList: the returned EPCs

## Happy Path

1. Authenticate: `POST /auth` with the role `apikey` header; capture `access_token`.
2. Build the EPCIS document: SBDH sender = the acting GLN, receiver = the counterparty GLN, and a fresh UUID as `instanceIdentifier`.
3. Submit: `POST /scp/SendEPCIS` with `apikey` + `Authorization: Bearer <token>` and `Content-Type: application/json`.
4. Receive **`202 Accepted`** — the submission is queued, not applied.
5. Poll `POST /MsgStatusQuery` with `{ "instanceIdentifier": "<the uuid>" }` until a terminal state.
6. Assert `SUCCESS`.
7. Confirm the resulting pack state with `POST /VerifyProduct` (and/or `GET /epcis` for the event record).

Final state: the packs move from **Returned** to **Available** at the receiver.

## Edge Cases & Validation Rules

### Specific to this feature

- Receiving a return against a closed or non-existent return reference.
- Receiving a return from a GLN that never returned anything.
- Receiving EPCs not part of the named return reference.
- Receiving the same return twice.
- Partial return receiving — fewer EPCs than were returned.
- Receiving a return the returner subsequently cancelled.
- Whether a returned-and-received pack may be shipped again — the business-critical question this feature ultimately answers.

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
