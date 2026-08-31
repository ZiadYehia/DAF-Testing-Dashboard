# EPTTS APIs — Module Overview

The Masar B2B API: a GS1 EPCIS implementation through which trade partners report supply-chain
events and query the resulting traceability graph. This module holds **11 features / 348 test cases**
extracted from `EPTTS - API TEST CASES.xlsx`, one feature per spreadsheet sheet.

## Base URLs (production, Citrix VPN required)

| Service | Base URL | Env key |
|---|---|---|
| `masar-service` (events, queries) | `https://192.168.225.195:8444/masar-service/api/v1` | `EPTTS_MASAR_API_URL` |
| `registry-service` (auth, registry) | `https://192.168.225.195:8445/registry-service/api/v1` | `EPTTS_REGISTRY_API_URL` |
| Dashboard | `https://192.168.225.195:8444` | `EPTTS_WEB_BASE_URL` |

TLS is a **self-signed certificate**: `ignoreHTTPSErrors: true` in Playwright, `-k` in curl. There is
**no OpenAPI/Swagger spec** — nginx serves the SPA `index.html` for any unmatched path, so a `200`
from `/v3/api-docs` or `/swagger-ui` is meaningless (a deliberately bogus path returns `200` too).
Only `/masar-service/api/v1/*` is a live API surface; it returns proper JSON `404`s.

## Endpoint map

| Purpose | Method + path | Sync? |
|---|---|---|
| Obtain a bearer token | `POST /auth` | `200` |
| Submit any EPCIS event | `POST /scp/SendEPCIS` | `202` + poll |
| Dispense (full / partial / cancel) | `POST /Dispensation` | `200` |
| Poll a submission's outcome | `POST /MsgStatusQuery` | `200` |
| Current state of one pack | `POST /VerifyProduct` | `200` |
| List invoices | `GET /scp/invoices?page=&limit=` | `200` |
| Export an SSCC | `GET /scp/sscc/{sscc}/export?scope=invoice` | `200` |
| List EPCIS messages | `GET /epcis` | `200` |
| Master-data snapshot URL | `GET /master-data/snapshot/latest` | `200` |

> **RESOLVED by live probing — see `verified-live-contract.md`, which supersedes this table where
> they differ.** `/auth` lives on **`:8445/registry-service/api/v1/auth`**; the collection's
> `masar-service/auth` is a **404 and does not exist**. Both `/scp/SendEPCIS` and `/epcis/json` are
> live with different error envelopes; the suite targets `/scp/SendEPCIS`, and which is *intended*
> remains an open question for the PO.

## Authentication

Two headers on every event/query request:

```
apikey: <role API key>
Authorization: Bearer <access_token from POST /auth>
```

`POST /auth` sends the `apikey` header and returns `{ "access_token": "..." }`.

**Verified live:** a valid `apikey` is mandatory and `access_token` comes back with
`expires_in: 900` (15 minutes). The body is **optional but not ignored**: the legacy
username/password path still engages when *both* fields are present and non-empty (a wrong pair
gives `401`), and is skipped when either is empty, null, or absent. No credential pair can
substitute for a valid key.

So the spreadsheet's note *"In new version, it depends only on apikey"* is true for the common case
but misleading — `TC_AUTH_006` is testable exactly as written. And `TC_AUTH_007`–`010` expected
`400` for empty/missing credential fields where the platform returns `200`, which is a **probable
validation defect**. See `verified-live-contract.md` for the full matrix.

**Also verified: the `apikey` header is not required after `/auth`.** `Bearer` alone behaves
identically to `apikey + Bearer` on every endpoint; `apikey` alone gives `401`. The collection sends
`apikey` on every request, which is harmless but misleading — any case whose objective is "verify a
valid/invalid API key in the header" belongs against `/auth`, not the event endpoints.

API keys are issued from the **dashboard**, which is why dashboard recon precedes API execution.
Keys live only in `automation-hub/.env` (`EPTTS_MFG_APIKEY`, `EPTTS_BRANCH_APIKEY`,
`EPTTS_PHARMACY_APIKEY`, `EPTTS_INTEGRATOR_APIKEY`) — never in `data/`, which is committed.

## The asynchronous contract

This is the single most important thing to get right, and the most common source of false passes:

1. `POST` an EPCIS document → **`202 Accepted`**. This means *queued*, not *applied*.
2. `POST /MsgStatusQuery` with `{ "instanceIdentifier": "<the id you sent>" }` → poll until a
   terminal state (`SUCCESS`, or a failure state).
3. Only then assert the resulting pack state via `POST /VerifyProduct` or `GET /epcis`.

A test case whose only expected result is `202` has verified that the request was well-formed and
nothing more. Negative cases split into two distinct shapes, and confusing them is a real defect
source:

- **Synchronous rejection** — a malformed request (empty `epcList`, missing mandatory field, bad
  content type) is rejected with `400`, **no event is queued, and no `MsgStatusQuery` record
  exists**.
- **Asynchronous failure** — a well-formed request whose *business rules* fail (unknown EPC, wrong
  GLN ownership, invalid state transition) returns `202`, and `MsgStatusQuery` later returns
  `FAILED` with a reason.

`Dispensation` is the exception: it responds `200` synchronously with no polling step.

## Request envelope

Every event posts the same envelope; only the `eventList` entry varies.

```json
{
  "@context": ["https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonld"],
  "type": "EPCISDocument",
  "schemaVersion": "2.0",
  "creationDate": "<ISO 8601 with offset>",
  "sbdh": {
    "headerVersion": "1.3",
    "sender":   { "identifier": "<acting GLN>" },
    "receiver": { "identifier": "<counterparty GLN>" },
    "documentIdentification": {
      "standard": "EPCGlobal", "typeVersion": "1.0",
      "instanceIdentifier": "<uuid — the MsgStatusQuery handle>",
      "type": "Events", "creationDateAndTime": "<ISO 8601 with offset>"
    }
  },
  "epcisBody": { "eventList": [ /* see the per-feature table below */ ] }
}
```

Every endpoint also accepts an **EPCIS 1.2 SOAP/XML** equivalent (`Content-Type: application/xml`,
`soap:Envelope` wrapping `epcis:EPCISDocument`). JSON and XML are separate code paths and both need
coverage; the XML path additionally warrants an XXE test.

## Event shapes by feature

| Feature | Event `type` | `action` | `bizStep` | `disposition` | Distinctive fields |
|---|---|---|---|---|---|
| `api-commission` | ObjectEvent | `ADD` | `commissioning` | `active` | `ilmd` (lot + expiry), `epcList` of new SGTINs |
| `api-packing` | AggregationEvent | `ADD` | `packing` | `active` | `parentID` (SSCC) + `childEPCs` |
| `api-unpacking` | AggregationEvent | `DELETE` | `unpacking` | `active` | `parentID` + `childEPCs` to remove |
| `api-shipping` | ObjectEvent | `OBSERVE` | `shipping` | `in_transit` | `sourceList`, `destinationList`, `bizTransactionList` (invoice) |
| `api-receiving` | ObjectEvent | `OBSERVE` | `receiving` | `in_progress` | `sourceList` (shipper) |
| `api-return` | ObjectEvent | `OBSERVE` | `shipping` | `returned` | `sourceList`, `destinationList`, return reference in `bizTransactionList` |
| `api-return-receiving` | ObjectEvent | `OBSERVE` | `receiving` | `returned` | `sourceList`, return reference |
| `api-destruction` | ObjectEvent | `DELETE` | `destroying` | `destroyed` | `epcList` only |
| `api-dispensing` | ObjectEvent | `OBSERVE` | `retail_selling` | `retail_sold` | posted to `/Dispensation` |
| `api-partial-dispensing` | ObjectEvent | `OBSERVE` | `retail_selling` | `retail_sold` | adds `quantity` |

Related events outside the 11 sheets, present in the collection and worth covering later:
`void_shipping` (shipping cancel), `decommissioning` + `recalled` (recall), and the exception
dispositions `stolen`, `lost`, `damaged`, `expired`, plus `inspecting` (sampling).

## Pack lifecycle

```
(nonexistent) --commissioning--> Commissioned --packing--> Packed
Packed/Commissioned --shipping--> In transit --receiving--> Received / In stock
Received --retail_selling(+quantity)--> Partially Dispensed --> Dispensed
Received/In stock --shipping+returned--> Returned --receiving+returned--> Available
any --destroying--> Destroyed        any --decommissioning--> Recalled / Decommissioned
```

Every invalid transition must be **rejected**, not silently accepted. Most of this module's negative
cases exist to prove exactly that, and `MsgStatusQuery` returning `FAILED` is the pass condition for
them.

## Identifier formats

| Kind | Format | Example |
|---|---|---|
| GLN | 13 digits, GS1 check digit | `8435308300002` |
| SGLN | `urn:epc:id:sgln:<company>.<location>.<ext>` | `urn:epc:id:sgln:5413868.00000.0` |
| GTIN | 14 digits, registered under the partner's GCP | `06290009990011` |
| SGTIN | `urn:epc:id:sgtin:<company>.<item>.<serial>` | `urn:epc:id:sgtin:629000999.0001.Serial1` |
| SSCC | `urn:epc:id:sscc:<company>.<serial>` | `urn:epc:id:sscc:05413868.0099000001` |

## Test-data state: what needs re-mapping

The extracted cases carry **staging-era GLNs** from the original spreadsheet, which do **not** match
the production devsim tenant:

| Role | In the spreadsheet | devsim (production) — **confirmed** |
|---|---|---|
| Manufacturer | `5413868000009` | `8435308300002` — INSTITUTO GRIFOLS, S.A. |
| Branch / distributor | `6224010009998` / `9506000140476` | `0085412000008` — Baxter International Inc. |
| Pharmacy | `6221385005587` / `6224010005228` | `1234567890128` — test pharmacy |
| Platform admin | — | `9999999999999` — Masar Platform Pilot |

All three trade-partner roles exist in devsim with working B2B keys, so **every cross-role feature
can execute end to end.** Note the role vocabulary: the platform has **no `branch`-role users** —
branch behaviour is carried by the `distributor` role, so cases written as "Authenticated as Branch"
map to `distributor`.

Real catalogue GTINs confirmed (replacing the sheet's placeholders): `00300020007554` Human Insulin,
`00300020012558` Fluoxetine, `05000456010870` budesonide, `05415062126240` ABRYSVO,
`08718692511262` OMNIC ocas.

## Source-suite condition

Provenance for what is in this module, so nothing here is mistaken for verified coverage:

- **348 rows** carry over with their **original TestCase IDs verbatim**, including the inconsistent
  `TC_` / `TS_` prefixes, so results map 1:1 back to the spreadsheet. Do not renumber them.
- **324 rows** were fully authored in the source.
- **24 rows were incomplete and have been authored** (each flagged in its feature's
  `## Notes & Known Defects`, and regenerable from `scripts/eptts-web-api-overrides.json`):
  - `TC_SHIP_025`–`TC_SHIP_044` — 20 entirely empty reserved ID slots (an ID and `Validity: Negative`
    and nothing else). Now cover mandatory-field, format, ownership, role, idempotency, content-type,
    and injection negatives, continuing the sequence the sheet began at `TC_SHIP_020`.
  - `TC_AUTH_013` — had a title only.
  - `TC_COMM_040`–`TC_COMM_042` — had steps but no expected results.
- **Recorded statuses are historical**, from staging: 279 pass, 25 fail, 19 blocked, 25 new. They
  seed the Execution tab as a starting point; nothing in this module has been executed against
  production yet.
- **Known defects carried over** — `TS_RECV_001` → `DW-878`. Open reviewer question on
  `TC_COMM_003`: it is marked *Positive* for commissioning an already-commissioned pack, which the
  reviewer flagged as wrong — the system should reject it. Treat as a spec question for the PO, not a
  test-data problem.
- `TC_COMM_041` / `TC_COMM_042` are recorded `Fail`: the platform currently **accepts** a `readPoint`
  / `bizLocation` belonging to another GLN. Their expected results state the correct (rejecting)
  behaviour, so they legitimately fail until fixed.

## Execution

Each feature maps to one Automation Hub project (`automation-hub/projects/eptts-api-<area>/`) built
on Playwright's `request` fixture — no browser. Shared helpers (auth token cache, EPCIS body
builders, `MsgStatusQuery` polling, unique EPC generation) live in `automation-hub/lib/eptts-api.ts`.
A Postman collection is generated alongside for manual use.

Projects are tagged by write impact — `readonly`, `write`, `destructive` — so runs can be sliced.
**These tests execute against production.** Every generated EPC uses a run-scoped unique serial so
repeated runs cannot collide on already-commissioned identifiers, but commissioning, shipping,
destruction, and dispensing all write permanent EPCIS events.
