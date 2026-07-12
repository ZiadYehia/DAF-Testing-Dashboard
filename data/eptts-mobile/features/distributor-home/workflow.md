# Distributor Home — Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Distributor Home |
| **Slug** | `distributor-home` |
| **Module** | Distributor |
| **Navigation Path** | Landing → Sign In (distributor credentials) → Home |
| **Priority** | P1 |

## Business Purpose

The home screen for the Distributor role. Distributors receive pharmaceutical products from manufacturers and dispatch them to pharmacies and branches. The tile grid provides access to all distributor supply-chain operations.

## UI Elements

| Element | Type | Content-Desc |
|---------|------|--------------|
| Create Shipment tile | Navigation card | `~Create Shipment` |
| My Shipments tile | Navigation card | `~My Shipments` |
| Receive Shipment tile | Navigation card | `~Receive Shipment` |
| Returns tile | Navigation card | `~Returns` |
| EPCIS History tile | Navigation card | `~EPCIS History` |

## Happy Path

1. User authenticates with distributor credentials (`testdistributor2@eptts.com`).
2. Distributor home screen appears with **5 tiles** in a grid:
   - **Create Shipment** — create a new outbound shipment to a pharmacy or branch
   - **My Shipments** — view all outbound shipments and their statuses
   - **Receive Shipment** — accept incoming shipments (from manufacturers)
   - **Returns** — manage product returns (sub-menu with 3 options)
   - **EPCIS History** — view the full EPCIS event log
3. Tap any tile to navigate to that feature.

## Notes

- The distributor sits between manufacturers and pharmacies/branches in the supply chain.
- No explicit Logout tile was observed in the initial screenshot; logout is likely accessed via a different mechanism.
