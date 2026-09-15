# Shipping — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Shipping |
| **Slug** | `web-shipping` |
| **Feature ID** | `EPTTS_WEB_32` |
| **Module** | product-movement |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/shipments` |
| **Text direction** | ltr |
| **Priority** | P1 |

## Business Purpose

Where a consignment leaves a party: an invoice number is entered, SSCCs are attached and a shipping event is written. The page loads the registry's distributor/hospital/branch/pharmacy lists to pick a destination, so a missing or inactive party here blocks despatch entirely. Custody does NOT move at this step — the pack stays with the sender until the receiver confirms — which is the single most misunderstood rule in the flow.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Shipping | Heading | — |
| AR | Button / action | — |
| shipments.bulkUpload | Button / action | — |
| View History | Button / action | — |
| Start Invoice | Button / action | — |
| Enter invoice number... | input | Enter invoice number... |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/shipments`.
4. The page loads with the heading "Shipping".

## Edge Cases & Validation Rules

- **Role isolation** — a role without access must be refused on direct URL entry, not merely have the menu entry hidden.
- **Session expiry** — an expired Keycloak session must redirect to login, never display stale data.
- **Backend failure** — a failing API call must surface an error state, not render empty data as a valid result.
- **Bilingual UI** — the dashboard defaults to Arabic (RTL) with an EN toggle; layout and data must be correct in both directions.

## API calls observed

Captured from the browser during discovery — these are the endpoints this page depends on:

```
GET 200 /masar-service/api/v1/users/me
GET 200 https://192.168.225.195:8445/registry-service/api/v1/entities?type=distributor&limit=30&offset=0
GET 200 https://192.168.225.195:8445/registry-service/api/v1/entities?type=hospital&limit=30&offset=0
GET 200 https://192.168.225.195:8445/registry-service/api/v1/entities?type=branch&limit=30&offset=0
GET 200 https://192.168.225.195:8445/registry-service/api/v1/entities?type=pharmacy&limit=30&offset=0
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases carry Status `Under Testing`; none has been executed yet.

## Dispatch flow, driven end to end 2026-09-08 (as the manufacturer)

The page walks three states. `workflow.md` previously recorded only the first.

**1. New Shipping Invoice.** `Destination Branch` is a PrimeNG `p-select` (a div, NOT a native
`<select>`) with a `Search branches...` searchbox. Its options are BOTH distributor entities and
their branches: `Test Distributor / 5413868000108` sits along`Main Warehouse / 5413868010008`,
`Test Branch 40 / 5413868010404` and ~40 more, each captioned with its parent. `Invoice Number *`
is DISABLED until a destination is chosen, reading `Select a destination first`, and
`Start Invoice` stays disabled until both are set.

**2. Draft.** Heading becomes `Invoice: <number> to <destination>` with a `Draft` badge. Controls:
`Add SSCC`, `Create SSCC`, `Add Individual Packs`, and a `Scan SSCC barcode...` input that accepts
the 18-digit element string and adds it on Enter. The items table is `TYPE / CODE / PACKS / LABEL`
and the header reads `Invoice Items | N pack(s) total`. `Dispatch to <destination>` is disabled
while the invoice is empty.

**3. Dispatched.** A `Shipment Dispatched` panel states the invoice, the SSCC aggregations and the
total packs, plus `1 SSCC aggregation(s) dispatched without print confirmation` when labels were
never printed, and a `Done` button.

### Two confirmation gates, and they are different kinds

- Dispatching with unprinted labels raises a **PrimeNG confirm dialog** (`div.p-confirmdialog`,
  `role=alertdialog`): "Unprinted Labels - 1 SSCC label(s) not yet confirmed printed. Dispatch
  anyway?" with `Go Back` / `Dispatch`. Accept it by clicking
  `.p-confirmdialog-accept-button` (note: `-accept-button`, not `-accept`). This is a DOM dialog,
  so a Playwright `dialog` handler does nothing for it - it must be clicked. That is the opposite
  of the billing portal on :8446, where every write is a native `window.confirm` that must be
  handled and cannot be clicked.
- The `p-confirmdialog` custom element itself is EMPTY; the content lives in a sibling
  `div.p-confirmdialog`. Querying the custom element finds no buttons.

### Button names carry a leading space

`Start Invoice` and `Dispatch to <destination>` render an icon span before the label, so their
accessible names are `" Start Invoice"` and `" Dispatch to Test Distributor"`. An exact-name
lookup without the space finds nothing - the same trap `dashboard.page.ts` documents for PrimeNG
tabs.

## API calls observed

Dispatch is ASYNCHRONOUS: the click returns 202 and the verdict arrives on an operations stream,
so a spec must not treat the 202 as success.

```
POST 201 /masar-service/api/v1/shipments/draft
POST 201 /masar-service/api/v1/shipments/draft/{draftId}/add-sscc
POST 202 /masar-service/api/v1/portal/operations/ship/draft/{draftId}
GET  200 /masar-service/api/v1/portal/operations/{operationId}/stream
GET  200 /masar-service/api/v1/shipments/{draftId}
```

## Notes

- **Re-documented 2026-09-08** by dispatching a real shipment: SSCC `254138686930300015` (4 packs,
  GTIN 05413868110449) from MAH `5413868000009` to `Test Distributor / 5413868000108` under
  invoice `QA-SHIP-MTTAE28H5MO`.
- **The billing gate was Advisory at the time, and the dispatch SUCCEEDED with the invoice
  unpaid - which is correct.** `GET :8446/masar-service/api/v1/billing/posture` answered
  `{"mode":"advisory","record":true,"enforce":false,"serviceEnabled":true,"source":"default(advisory)"}`
  while `INV-20260908-000018` (28.00 EGP, the invoice for exactly those 4 packs) was still
  Pending. Advisory records without blocking, so this is WEB_SHP_010 verified rather than a
  defect. WEB_SHP_009 needs the mode flipped to Enforce to mean anything.
- **`/billing/posture` is 404 on :8444 and 403 to a manufacturer on :8446** ("available to: Daf
  admin, support, Finance"). An older bug report cites it on :8444; it is not there now.
- `shipments.bulkUpload` still renders as a raw translation key.
- Custody does NOT move on dispatch - the pack stays with the sender until the receiver confirms.
