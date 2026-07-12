# Branch Home — Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Branch Home |
| **Slug** | `branch-home` |
| **Module** | Branch |
| **Navigation Path** | Landing → Sign In (branch credentials) → Home |
| **Priority** | P1 |

## Business Purpose

The home screen for the Branch role. A Branch is a warehouse or storage facility that sits between the distributor and pharmacies in the supply chain. The tile grid provides access to all branch operations — creating/receiving shipments, managing returns, EPCIS history, and account management.

## UI Elements

| Element | Type | Content-Desc |
|---------|------|--------------|
| Header | Label | "Hello / Main warehouse" (branch entity name) |
| Create Shipment tile | Navigation card | `~Create Shipment` |
| My Shipments tile | Navigation card | `~My Shipments` |
| Receive Shipment tile | Navigation card | `~Receive Shipment` |
| Returns tile | Navigation card | `~Returns` |
| EPCIS History tile | Navigation card | `~EPCIS History` |
| Delete Account tile | Destructive action | `~Delete Account` |
| Logout tile | Session action | `~Logout` |

## Happy Path

1. User authenticates with branch credentials (`testbranch@eptts.com`).
2. Branch home screen appears with the header: **"Hello / Main warehouse"**.
3. **7 tiles** are visible in a grid (3 rows of 2 + 1 standalone):
   - **Create Shipment** (top-left, teal)
   - **My Shipments** (top-right, purple)
   - **Receive Shipment** (mid-left, peach/salmon)
   - **Returns** (mid-right, blue/grey)
   - **EPCIS History** (lower-left, green)
   - **Delete Account** (lower-right, pink/red — destructive)
   - **Logout** (bottom, grey/white)
4. Tap any tile to navigate.

## Notes

- The branch entity name shown ("Main warehouse") is the account's registered GLN name.
- The Branch home has more tiles than the Inspector (7 vs 4) and the same core set as the Distributor but with Delete Account and Logout shown.
