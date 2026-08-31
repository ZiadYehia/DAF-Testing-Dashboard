---
type: domain
priority: 10
---
# EPTTS API — Domain Knowledge

The Masar Platform's **B2B API**: the machine-to-machine surface that trading partners —
manufacturers, distributors and pharmacies — use to report the movement of every
pharmaceutical pack through the Saudi supply chain. It is a track-and-trace system, so the
question it answers is always *where is this specific pack, and is its history coherent?*

This app covers **only the API**. The web dashboard is the separate `eptts-web` app, and the
two authenticate against completely different credential stores (see below).

## What is being tracked

A **pack** is one saleable unit, identified by an **SGTIN** — a GTIN (the product) plus a
serial (that individual box). Packs are grouped into a container identified by an **SSCC**.
Locations and companies are identified by **GLN** / **SGLN**. All are GS1 identifiers carried
as URNs, e.g. `urn:epc:id:sgtin:84353083.05448.SERIAL`.

Events are **EPCIS 2.0** documents. Two event types cover everything here:

- `ObjectEvent` — commissioning, shipping, receiving, dispensing, destruction, returns
- `AggregationEvent` — packing (children into a parent SSCC) and unpacking

## The lifecycle, and the rule that governs it

```
commissioned ──pack──> aggregated ──ship──> in_transit ──receive──> held by receiver
                                                                   ├──> dispensed  (terminal)
                                                                   ├──> destroyed  (terminal)
                                                                   └──> returned ──> back upstream
```

`pack.status` is **lowercase** (`active`, `in_transit`, `dispensed`, `destroyed`) — not the
title-case names the test cases use in prose.

**The rule almost every negative test is really about: an event must be consistent with the
pack's current state and holder.** You cannot dispense what you never received, ship what you
do not hold, or commission the same serial twice. When the platform refuses something, it is
usually enforcing this — read the refusal before assuming a defect.

**Custody moves on receipt, not despatch.** `pack.currentGln` stays with the sender through
`in_transit` and only changes when the receiver posts its own receiving event. A test that
expects custody to move at shipping will look broken when the platform is right.

## Everything is asynchronous

A 2xx response means **accepted for processing**, never *done*. The real outcome comes from
polling `POST /MsgStatusQuery` with the `instanceIdentifier` from the document's SBDH, and
reading `messagestatus`:

- `S - Successful` — the events were applied
- `E - Application Error` — rejected; the per-event `logList` says which event and why

**A `202` (or `200`) with an `E` outcome is the single most common way to misread this API.**
Assert the polled status and the `logList`, never the acknowledgement code. A `404` from
`MsgStatusQuery` means *not ready yet* — keep polling.

## Two credential systems, and only one of them is here

- **B2B API** — a per-partner `apikey`, exchanged **once** at
  `POST /auth` on registry-service for a 15-minute bearer token. Every other endpoint takes
  `Authorization: Bearer` alone; `apikey` on its own is refused.
- **Dashboard** — Keycloak OIDC, a completely separate store. Dashboard logins are rejected
  by the B2B `/auth`, and vice versa.

So a test whose objective is "verify behaviour with a valid/invalid API key" belongs on
`/auth`. Asserting that an event endpoint requires the `apikey` header asserts something
untrue.

## Roles decide what an endpoint will even accept

Manufacturers commission, pack and ship. Distributors and pharmacies receive and dispense —
a manufacturer calling `/Dispensation` gets a synchronous `403`. Only distributors and
pharmacies have invoices. Role isolation is therefore a first-class test dimension, not an
afterthought.

## Where the authoritative detail lives

This document is the orientation. The **verified live contract** — endpoint by endpoint,
including the three different error-envelope shapes, the exact response bodies, and every
place the vendor documentation disagrees with the deployed platform — is
`modules/eptts-apis/knowledge/verified-live-contract.md`. Read that before writing or
changing an API test case; it exists because several of its entries cost real debugging time
to establish.

## Environment

Production only, reachable **only over the Citrix VPN**, on a self-signed certificate (so
every client needs `ignoreHTTPSErrors`). Test data is the `devsim` tenant. Writes are
permanent: every generated serial is run-scoped so repeated runs cannot collide, and no test
may reuse an identifier a previous run consumed.
