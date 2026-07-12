# Branch Module — Domain Knowledge

## Role
Login with a **Branch** account (`testbranch@eptts.com` / `Admin@123456`). A Branch is a **warehouse or storage facility** that acts as an intermediary between the distributor and pharmacies.

## Business Purpose
Branches receive pharmaceutical stock from distributors and manufacturers, store it, and dispatch shipments to pharmacies. They also handle bidirectional returns. The branch account in test data is named **"Main warehouse"**.

## Features (all verified via live Appium exploration 2026-07-09)

| Feature | Slug | Key Screens |
|---------|------|-------------|
| Branch Home | `branch-home` | 7-tile grid |
| Create Shipment | `branch-create-shipment` | Form (Destination GLN + ERP Invoice + Create Draft) |
| My Shipments | `branch-my-shipments` | List → Shipment Details (Cancel Shipment button for Dispatched) |
| Receive Shipment | `branch-receive-shipment` | Incoming Invoices list → Scan Screen (Scan Progress + Scan Barcode) |
| Returns | `branch-returns` | Sub-menu → Manufacturer Return + My Returns + Incoming Returns |
| EPCIS History | `branch-epcis-history` | List → Error bottom sheet for Failed events |

## Home Screen Tiles (verified 2026-07-09)

| Tile | Content-Desc | Colour |
|------|-------------|--------|
| Create Shipment | `~Create Shipment` | Teal |
| My Shipments | `~My Shipments` | Purple |
| Receive Shipment | `~Receive Shipment` | Peach/Salmon |
| Returns | `~Returns` | Blue/Grey |
| EPCIS History | `~EPCIS History` | Green |
| Delete Account | `~Delete Account` | Pink/Red |
| Logout | `~Logout` | Grey/White |

**Header**: `content-desc="Hello\nMain warehouse"` (entity name = "Main warehouse")

## Verified Screen Details

### Shipment Detail
- Page title: `"Shipment Details"`
- Has a **Cancel Shipment** button (red) for Dispatched shipments
- Item cards show SSCC codes + status (e.g. `6 pack(s)  •  in_transit`) — not drillable

### Receive Shipment Scan Screen
- Page title stays `"Receive Shipment"` (not "Incoming Invoices") after tapping a card
- Scan button label: `"Scan Barcode"` (distinct from Dispense/ReturnPack's `"Tap to scan GTIN / SGTIN"`)
- Tabs: `"Scanned (0)"` and `"Remaining (0)"` — include count suffix in content-desc

### Returns — Return Details
- Same page (`"Return Details"`) for both My Returns and Incoming Returns detail
- **My Returns** (outgoing, branch → manufacturer):
  - Type field: `"branch to manufacturer"`
  - CONFIRMED/CANCELLED = read-only, no action buttons
- **Incoming Returns** (incoming, pharmacy → branch):
  - Type field: `"pharmacy to branch"`
  - PENDING = two action buttons: `"Confirm Return"` (green) and `"Cancel Return"` (red outline)
  - Once actioned, becomes read-only

### EPCIS Error Detail
- Tapping a Failed EPCIS card opens an **error bottom sheet** (NOT a new page)
- Bottom sheet structure: event hash title, × close button, per-event list with Sequence#, event type, `INTEGRITY_ERROR` code, error message
- Error example: "SSCCs not found in system: 705413868924425286"

## Supply Chain Position

```
Manufacturer → Distributor → [Branch] → Pharmacy → Patient
```

## Test Credentials

| Field | Value |
|-------|-------|
| Email | `testbranch@eptts.com` |
| Password | `Admin@123456` |

## Business Rules

- Token expires every **15 minutes** — app shows "Unauthorized" + non-functional Retry button
- Logout requires confirmation: tap tile → dialog with `Cancel` + `android.widget.Button[@content-desc="Logout"]`
- Item cards in Shipment Details are NOT navigable (no detail drill-down)
- EPCIS "View event errors" is embedded in card composite content-desc — tap the whole card to open the error bottom sheet
- PENDING incoming returns MUST be Confirmed or Cancelled by the branch before they expire

## Home Screen Tiles
| Tile | Content-Desc | Colour |
|------|-------------|--------|
| Create Shipment | `~Create Shipment` | Teal |
| My Shipments | `~My Shipments` | Purple |
| Receive Shipment | `~Receive Shipment` | Peach/Salmon |
| Returns | `~Returns` | Blue/Grey |
| EPCIS History | `~EPCIS History` | Green |
| Delete Account | `~Delete Account` | Pink/Red |
| Logout | `~Logout` | Grey/White |

## Supply Chain Position
```
Manufacturer → Distributor → [Branch] → Pharmacy → Patient
```

## Comparison with Distributor
| Aspect | Distributor | Branch |
|--------|-------------|--------|
| Home tile count | 5 | 7 (adds Delete Account + Logout) |
| Header text | — | "Hello / [Branch name]" |
| Create Shipment form | Identical | Identical |
| Returns sub-menu | Identical | Identical |
| Receive senders | Manufacturers | Manufacturers + Distributors |

## Observed Incoming Senders (Receive Shipment)
- Bio Egypt
- Janssen
- Upjohn EESV
- Pharmaoverseas Importer

## Shipment Statuses
Same as Distributor: **Draft**, **Dispatched**, **Delivered**, **Partially Delivered**

## EPCIS Event Types
| Type | Trigger |
|------|---------|
| SHIPPING | Branch dispatches a shipment |
| RECEIVING | Branch receives a shipment |
| UNPACKING | Container is unpacked at branch |

## Test Credentials
| Field | Value |
|-------|-------|
| Email | `testbranch@eptts.com` |
| Password | `Admin@123456` |

## Business Rules
- Create Shipment: Destination GLN + ERP Invoice Number required (same as Distributor)
- Receive Shipment: scan all packs against the invoice manifest
- Returns sub-menu is identical to Distributor returns (same 3 sub-features, same UI)
- Logout requires confirmation via dialog (same pattern as Inspector)
- Delete Account is a destructive action requiring confirmation