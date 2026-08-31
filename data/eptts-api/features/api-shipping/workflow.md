# Shipping — API Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Shipping |
| **Slug** | `api-shipping` |
| **Feature ID** | `EPTTS_API_06` |
| **Module** | EPTTS APIs |
| **Endpoint** | `POST /scp/SendEPCIS` |
| **Acting role** | Manufacturer, Branch, or Pharmacy (returns) |
| **Response mode** | Asynchronous — `202` then `MsgStatusQuery` |
| **Priority** | P1 |
| **Test cases** | 44 |

## Business Purpose

Transfers custody: packs leave the sender and become **In transit** toward a destination GLN. The busiest feature in the module and the one with the richest request body — it is the only event carrying `sourceList`, `destinationList`, and a `bizTransactionList` invoice reference, so it has the largest mandatory-field surface.

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
  "disposition": "in_transit",
  "epcList": ["<EPC URN>", "..."],
  "readPoint":   { "id": "<acting SGLN>" },
  "bizLocation": { "id": "<acting SGLN>" }
}
```

**Distinctive fields** — `sourceList`: `{ type: urn:epcglobal:cbv:sdt:owning_party, source: <sender SGLN> }` · `destinationList`: `{ type: ..., destination: <receiver SGLN> }` · `bizTransactionList`: `{ type: urn:epcglobal:cbv:btt:desadv, bizTransaction: <invoice ref> }`

**EPC carrier** — epcList: the SSCCs and/or SGTINs being shipped

## Happy Path

1. Authenticate: `POST /auth` with the role `apikey` header; capture `access_token`.
2. Build the EPCIS document: SBDH sender = the acting GLN, receiver = the counterparty GLN, and a fresh UUID as `instanceIdentifier`.
3. Submit: `POST /scp/SendEPCIS` with `apikey` + `Authorization: Bearer <token>` and `Content-Type: application/json`.
4. Receive **`202 Accepted`** — the submission is queued, not applied.
5. Poll `POST /MsgStatusQuery` with `{ "instanceIdentifier": "<the uuid>" }` until a terminal state.
6. Assert `SUCCESS`.
7. Confirm the resulting pack state with `POST /VerifyProduct` (and/or `GET /epcis` for the event record).

Final state: the SSCC and every contained pack become **In transit**.

## Edge Cases & Validation Rules

### Specific to this feature

- Routes: Manufacturer→Branch, Branch→Branch, Branch→Pharmacy. Each is a distinct authorization path.
- A destination GLN not registered as a trade partner.
- Shipping a pack already in transit, or already in another open shipment.
- Shipping a non-existent, destroyed, or dispensed pack.
- Mandatory-field matrix — `epcList`, `bizTransactionList`, invoice number, `sourceType`, `destinationType`, `eventTime`, `eventTimeZoneOffset`, `action`, `bizStep`, `disposition`, `readPoint`, `bizLocation`, SBDH sender/receiver, `instanceIdentifier`. Each empty or omitted in turn.
- Injection payloads in the invoice number.
- Shipping Cancel / Void (`bizStep: void_shipping`) reverses an in-transit shipment — covered in the collection, not yet in these 44 cases.

### Applies to every event feature

- **Synchronous vs asynchronous rejection are different behaviours.** A malformed request (missing mandatory field, empty `epcList`, bad `Content-Type`) is rejected `400` with *no* event queued and *no* `MsgStatusQuery` record. A well-formed request that fails a business rule returns `202` and `MsgStatusQuery` later returns `FAILED`. A case that asserts the wrong one of these will pass against broken behaviour.
- **GLN ownership** — acting on an EPC owned by another GLN must fail. This is the platform's most important authorization rule and needs explicit coverage here.
- **Role authorization** — a role not permitted this operation must be refused even with a valid key and a well-formed body.
- **Idempotency** — re-using an `instanceIdentifier` must not create a second event.
- **JSON and XML are separate code paths.** The EPCIS 1.2 SOAP/XML variant needs its own coverage, including an XXE attempt.
- **Identifier validation** — malformed SGTIN/SSCC/SGLN URNs, GLNs failing the GS1 check digit, and non-ISO-8601 timestamps must all be rejected.

## Notes

- **`TC_SHIP_025`–`TC_SHIP_044` were 20 entirely empty reserved ID slots in the source spreadsheet** (an ID and `Validity: Negative`, nothing else). They have been authored to continue the mandatory-field sequence the sheet began at `TC_SHIP_020`, plus format, ownership, role, idempotency, content-type, and injection negatives. See `## Notes & Known Defects` in the test-case file and `scripts/eptts-web-api-overrides.json`.
- 8 of the 24 originally-authored cases are recorded `Fail` from staging.
- Test data in the extracted cases still carries **staging-era GLNs** that do not match the production devsim tenant. See the module overview's re-mapping table.
- Executing this feature writes to **production**. Generated EPCs use run-scoped unique serials so repeated runs cannot collide.
- Recorded statuses in the test-case table are historical (from staging) and seed the Execution tab; nothing here has been executed against production yet.
