# Distributor Module — Domain Knowledge

## Role
Login with a **Distributor** account (`testdistributor2@eptts.com` / `Admin@123456`). The Distributor receives pharmaceutical products from manufacturers and dispatches them to pharmacies and branches.

## Business Purpose
Distributors are mid-chain supply entities responsible for bulk receipt from manufacturers and onward distribution to branches and pharmacies. They manage outbound shipments, receive inbound stock, and handle return flows in both directions.

## Features

| Feature | Slug | Description |
|---------|------|-------------|
| Distributor Home | `distributor-home` | 5-tile grid |
| Create Shipment | `distributor-create-shipment` | Create outbound shipment to pharmacy/branch |
| My Shipments | `distributor-my-shipments` | View all outbound shipments + statuses |
| Receive Shipment | `distributor-receive-shipment` | Accept incoming shipments from manufacturers |
| Returns | `distributor-returns` | Sub-menu: Manufacturer Return / My Returns / Incoming Returns |
| EPCIS History | `distributor-epcis-history` | View all EPCIS events for this distributor |

## Home Screen Tiles
| Tile | Content-Desc |
|------|--------------|
| Create Shipment | `~Create Shipment` |
| My Shipments | `~My Shipments` |
| Receive Shipment | `~Receive Shipment` |
| Returns | `~Returns` |
| EPCIS History | `~EPCIS History` |

## Supply Chain Position
```
Manufacturer → [Distributor] → Branch / Pharmacy
```

## Create Shipment Form Fields
| Field | Type | Required |
|-------|------|----------|
| Destination GLN | Search autocomplete | Yes |
| ERP Invoice Number | Text input | Yes |
| Create Draft button | Action | — |

## Shipment Statuses
| Status | Meaning |
|--------|---------|
| Draft | Created but not yet dispatched; packs can be added |
| Dispatched | Sent to recipient; awaiting confirmation |
| Delivered | Confirmed received by recipient |
| Partially Delivered | Some packs confirmed; remainder pending |

## Returns Sub-Menu
| Sub-feature | Tile Colour | Purpose |
|-------------|-------------|--------|
| Manufacturer Return | Blue | Return packs to manufacturer (scan + optional note) |
| My Returns | Green | History of outgoing returns (CONFIRMED / CANCELLED) |
| Incoming Returns | Yellow/Tan | Returns from pharmacies/branches (PENDING / CANCELLED) |

## EPCIS Event Types
| Type | Trigger |
|------|---------|
| SHIPPING | Distributor dispatches a shipment |
| RECEIVING | Distributor receives a shipment |
| UNPACKING | Container is unpacked at distributor |

## Key Locators
| Element | Strategy | Selector |
|---------|----------|----------|
| Create Shipment tile | accessibility id | `~Create Shipment` |
| My Shipments tile | accessibility id | `~My Shipments` |
| Receive Shipment tile | accessibility id | `~Receive Shipment` |
| Returns tile | accessibility id | `~Returns` |
| EPCIS History tile | accessibility id | `~EPCIS History` |

## Test Credentials
| Field | Value |
|-------|-------|
| Email | `testdistributor2@eptts.com` |
| Password | `Admin@123456` |

## Verified Screen Details (2026-07-09)

### Receive Shipment
- List page title: **`"Incoming Invoices"`** (not "Receive Shipment")
- Tapping a card → opens **Receive Shipment scan screen** (page title: `"Receive Shipment"`)
- Same scan screen pattern as Branch: Scan Progress bar, `"Scan Barcode"` button, Scanned/Remaining tabs

### My Shipments Detail
- Page title: `"Shipment Details"` (same as Branch)
- Has **Cancel Shipment** button for Dispatched shipments

### Returns — Return Details
- Same `"Return Details"` page for My Returns and Incoming Returns detail
- My Returns detail (CONFIRMED/CANCELLED): read-only, no action buttons
- Incoming Returns detail (PENDING): has `"Confirm Return"` (green) and `"Cancel Return"` (red outline) buttons
- **Type field** values: `"branch to manufacturer"`, `"pharmacy to branch"`, etc.

### EPCIS History Error Detail
- Tapping a Failed event card → opens error detail **bottom sheet** (NOT a new page)
- Shows: Sequence#, event type, error code (`INTEGRITY_ERROR`), error message

## Token Expiry
- Access token: **15 minutes** (`expires_in=900s`)
- App does NOT auto-refresh → shows "Unauthorized" + Retry button (Retry does not work)
- Solution: logout and login again to refresh the session

