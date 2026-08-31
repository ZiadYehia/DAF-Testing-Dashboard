# Receiving — API Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Receiving |
| **Slug** | `api-receiving` |
| **Feature ID** | `EPTTS_API_07` |
| **Module** | EPTTS APIs |
| **Endpoint** | `POST /scp/SendEPCIS` |
| **Acting role** | Branch or Pharmacy |
| **Response mode** | Asynchronous — `202` then `MsgStatusQuery` |
| **Priority** | P1 |
| **Test cases** | 42 |

## Business Purpose

Accepts custody of an in-transit shipment: packs become **Received / In stock** at the receiver. The counterpart to shipping, and the point where discrepancies surface — a receiver claiming EPCs that were never shipped to it, or omitting some that were.

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
  "disposition": "in_progress",
  "epcList": ["<EPC URN>", "..."],
  "readPoint":   { "id": "<acting SGLN>" },
  "bizLocation": { "id": "<acting SGLN>" }
}
```

**Distinctive fields** — `sourceList`: `{ type: urn:epcglobal:cbv:sdt:owning_party, source: <shipper SGLN> }`

**EPC carrier** — epcList: the EPCs from the shipment

## Happy Path

1. Authenticate: `POST /auth` with the role `apikey` header; capture `access_token`.
2. Build the EPCIS document: SBDH sender = the acting GLN, receiver = the counterparty GLN, and a fresh UUID as `instanceIdentifier`.
3. Submit: `POST /scp/SendEPCIS` with `apikey` + `Authorization: Bearer <token>` and `Content-Type: application/json`.
4. Receive **`202 Accepted`** — the submission is queued, not applied.
5. Poll `POST /MsgStatusQuery` with `{ "instanceIdentifier": "<the uuid>" }` until a terminal state.
6. Assert `SUCCESS`.
7. Confirm the resulting pack state with `POST /VerifyProduct` (and/or `GET /epcis` for the event record).

Final state: the SSCC and its packs move from **In transit** to **Received / In stock**.

## Edge Cases & Validation Rules

### Specific to this feature

- Partial receive — fewer EPCs than were shipped. Confirm whether the shipment stays open, and what the un-received packs' state becomes.
- Over-receive — an EPC that was never shipped to this GLN.
- Receiving a shipment addressed to a *different* destination GLN. A core ownership case.
- Receiving the same shipment twice.
- Receiving a pack not in transit (still Commissioned, or already Received).
- Receiving after the shipment was voided.
- Empty `epcList`; missing `sourceList`.

### Applies to every event feature

- **Synchronous vs asynchronous rejection are different behaviours.** A malformed request (missing mandatory field, empty `epcList`, bad `Content-Type`) is rejected `400` with *no* event queued and *no* `MsgStatusQuery` record. A well-formed request that fails a business rule returns `202` and `MsgStatusQuery` later returns `FAILED`. A case that asserts the wrong one of these will pass against broken behaviour.
- **GLN ownership** — acting on an EPC owned by another GLN must fail. This is the platform's most important authorization rule and needs explicit coverage here.
- **Role authorization** — a role not permitted this operation must be refused even with a valid key and a well-formed body.
- **Idempotency** — re-using an `instanceIdentifier` must not create a second event.
- **JSON and XML are separate code paths.** The EPCIS 1.2 SOAP/XML variant needs its own coverage, including an XXE attempt.
- **Identifier validation** — malformed SGTIN/SSCC/SGLN URNs, GLNs failing the GS1 check digit, and non-ISO-8601 timestamps must all be rejected.

## Notes

- **`TS_RECV_001` is recorded `Fail` against `DW-878`** — receiving a complete shipment from the manufacturer. As the primary happy path of a P1 feature, this is the highest-value case to re-verify first against production.
- Test data in the extracted cases still carries **staging-era GLNs** that do not match the production devsim tenant. See the module overview's re-mapping table.
- Executing this feature writes to **production**. Generated EPCs use run-scoped unique serials so repeated runs cannot collide.
- Recorded statuses in the test-case table are historical (from staging) and seed the Execution tab; nothing here has been executed against production yet.
