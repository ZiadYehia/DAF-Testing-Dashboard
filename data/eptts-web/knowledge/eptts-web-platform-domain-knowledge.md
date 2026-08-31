# EPTTS Web — Platform & Domain Knowledge

## What this product is

EPTTS Web is the **Masar Platform** web surface: a browser dashboard plus a B2B REST API that together
form the central track-and-trace authority for serialized pharmaceuticals in the supply chain. Where
the desktop **Masar Agent** (app slug `eptts`) and the **EPTTS Mobile** app (`eptts-mobile`) are
*execution* clients used at a pharmacy counter or on a warehouse floor, EPTTS Web is the *system of
record*: it registers trade partners and products, issues the API keys those clients authenticate
with, ingests EPCIS events, and exposes the resulting traceability graph.

The API is a GS1 EPCIS implementation. Partners submit **EPCIS documents** (EPCIS 2.0 JSON or
EPCIS 1.2 SOAP/XML) describing business steps — commissioning, packing, shipping, receiving,
dispensing, destruction — and the platform maintains the authoritative lifecycle state of every
individual pack. This is not a CRUD application: correctness means serialization integrity,
state-machine validity, GLN ownership enforcement, and traceability completeness. A test that
confirms an endpoint returned `202` has verified almost nothing; the meaningful assertion is that the
asynchronous processing reached `SUCCESS` and the pack's state changed exactly as the business rule
requires.

## User roles

- **Platform Admin** — the regulator/operator tenant. Registers trade partners (manufacturers,
  branches/distributors, pharmacies), approves and manages their GLNs, issues and revokes API keys,
  curates master data, and has cross-tenant visibility into all EPCIS traffic.
- **Manufacturer** — commissions new packs into existence (the only role that may), aggregates them
  into SSCCs, ships to branches, receives returns, and destroys/decommissions its own product.
- **Branch / Distributor** — receives from manufacturers, re-aggregates, ships onward to pharmacies
  or other branches, handles returns in both directions, and records recalls and inspection sampling.
- **Pharmacy** — receives from a branch, dispenses to patients (full pack or partial quantity),
  cancels dispensations, and returns stock upstream.
- **POS Partner Integrator** — a third-party point-of-sale vendor acting *on behalf of* a pharmacy
  GLN, using an integrator key plus an `actingOnBehalfOfGln`. Same operations as Pharmacy, different
  authentication identity — which makes it a distinct authorization surface worth testing separately.

## Core concepts & entities

- **GLN** (Global Location Number, 13 digits) — identifies a trade partner/location. Every event
  carries a sender and receiver GLN, and the platform rejects operations on EPCs the acting GLN does
  not own. GLN ownership is the single most important authorization rule in the system.
- **SGLN** (`urn:epc:id:sgln:<company>.<location>.<extension>`) — the URN form of a GLN, used in
  event `readPoint` / `bizLocation`.
- **GTIN** (14 digits) — identifies a product/trade item. Must be registered under the
  manufacturer's GS1 Company Prefix (GCP) before its packs can be commissioned.
- **SGTIN** (`urn:epc:id:sgtin:<company>.<item>.<serial>`) — one individual serialized pack. The
  atomic unit of traceability.
- **SSCC** (`urn:epc:id:sscc:<company>.<serial>`) — a logistics container (case/pallet) that
  aggregates SGTINs. Aggregation is hierarchical and events on an SSCC cascade to its children.
- **EPCIS document** — the submission envelope: an SBDH header (sender, receiver,
  `instanceIdentifier`) plus an `epcisBody.eventList` of `ObjectEvent` / `AggregationEvent` entries,
  each with `action` (`ADD` / `OBSERVE` / `DELETE`), `bizStep`, and `disposition`.
- **`instanceIdentifier`** — the caller-supplied idempotency/correlation key for a submission. It is
  the handle used to poll processing status, and re-using one is itself a test scenario.
- **Pack lifecycle** — the state machine every assertion ultimately lands on:

```
(nonexistent) --commissioning--> Commissioned --packing--> Packed
Packed/Commissioned --shipping--> In transit --receiving--> Received / In stock
Received --retail_selling--> Partially Dispensed --> Dispensed
any --destruction--> Destroyed
any --return--> Returned --> Available
```

Invalid transitions must be rejected, not silently accepted — most negative test cases in this
suite exist to prove exactly that.

## Key workflows

1. **Onboarding** (Admin, dashboard) — register a partner, approve its GLN, register its GTINs,
   issue an API key. Nothing else in the platform works until this completes, which is why the API
   suite depends on the dashboard.
2. **Manufacture to distribution** (API) — Commission SGTINs, Pack into an SSCC, Ship to a branch,
   branch Receives, branch Ships to a pharmacy, pharmacy Receives.
3. **Dispense** (API) — pharmacy dispenses a full pack, or partially dispenses a quantity across
   several requests until the pack is exhausted; a dispensation can be cancelled.
4. **Reverse logistics** (API) — pharmacy Returns to branch, branch Return-Ships to manufacturer,
   manufacturer performs Return Receiving; returns can be cancelled while open.
5. **Exceptions** (API) — Destruction, Recall, Stolen, Lost, Damaged, Expired, Decommission,
   Sampling/Inspection.
6. **Query & audit** (API + dashboard) — `VerifyProduct` for a pack's current state,
   `MsgStatusQuery` for submission outcome, invoice listing, SSCC export, EPCIS message history,
   master-data snapshot download.

## The asynchronous contract

Most write endpoints are **fire-and-poll**, and getting this wrong is the most common source of false
passes:

1. `POST` an EPCIS document, receive **`202 Accepted`**. This means *queued*, not *applied*.
2. `POST /MsgStatusQuery` with the `instanceIdentifier`, poll until a terminal state
   (`SUCCESS` or a failure state).
3. Only then assert the resulting pack state via `VerifyProduct` or `GET /epcis`.

`Dispensation` is the exception — it responds **`200`** synchronously.

## Environments & access

- **Production** (the target of this suite) — requires the **Citrix VPN**.
  - Dashboard: `https://192.168.225.195:8444`
  - `masar-service` API: `https://192.168.225.195:8444/masar-service/api/v1`
  - `registry-service` API: `https://192.168.225.195:8445/registry-service/api/v1`
  - TLS uses a **self-signed certificate** — every client must ignore certificate errors
    (`ignoreHTTPSErrors` in Playwright, `-k` in curl).
  - No OpenAPI/Swagger spec is exposed; nginx serves the SPA `index.html` for any unmatched path, so
    a `200` from a doc URL is meaningless. Only `/masar-service/api/v1/*` is the live API surface.
- **Tenant** — `devsim`, a simulation tenant on the production host. Test accounts:
  - Platform Admin — `admin@devsim.local` · Masar Platform Pilot · GLN `9999999999999`
  - Manufacturer — `manufacturer@devsim.local` · INSTITUTO GRIFOLS · GLN `8435308300002` · 30 products
- **Credentials and API keys live only in `automation-hub/.env`.** `data/` is committed to git —
  test-case `Test Data` columns reference env key names, never secret values.

## Glossary

- **EPCIS** — Electronic Product Code Information Services; the GS1 standard for sharing supply-chain
  event data. v2.0 is JSON/JSON-LD, v1.2 is XML (wrapped in SOAP here).
- **CBV** — Core Business Vocabulary; the controlled `bizStep` / `disposition` values.
- **SBDH** — Standard Business Document Header; carries sender, receiver, and `instanceIdentifier`.
- **GCP** — GS1 Company Prefix; the licensed numeric prefix a partner's GTINs and SSCCs derive from.
- **`ilmd`** — Instance/Lot Master Data; lot number and expiry attached at commissioning.
- **Commissioning** — the act of bringing a serial number into existence as a real pack.
- **Aggregation / Disaggregation** — packing into and unpacking out of an SSCC.
- **Decommission** — permanently retiring a serial (destroyed, stolen, lost, expired, damaged).
- **`actingOnBehalfOfGln`** — delegation field letting a POS integrator operate as a pharmacy.
