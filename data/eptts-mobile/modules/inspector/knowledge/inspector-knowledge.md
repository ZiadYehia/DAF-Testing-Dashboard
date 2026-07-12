# Inspector Module — Domain Knowledge

## Role
Login with an **Inspector** account (`testinspector@eptts.com` / `Admin@123456`). The Inspector is a **regulatory/government auditor** with read-only access to the entire supply chain.

## Business Purpose
Inspectors monitor pharmaceutical supply-chain integrity on behalf of the national regulatory body (EDA — Egyptian Drug Authority). They can view all shipments across all parties and trace individual serialised packs or containers through the supply chain.

## Features

| Feature | Slug | Description |
|---------|------|-------------|
| Inspector Home | `inspector-home` | 4-tile grid: View Shipments, Trace, Delete Account, Logout |
| View Shipments | `inspector-view-shipments` | Browse all shipments across all parties (read-only) |
| Trace | `inspector-trace` | Trace a pack (SGTIN) or container (SSCC) through the supply chain |

## Home Screen Tiles
| Tile | Content-Desc | Action |
|------|-------------|--------|
| View Shipments | `~View Shipments` | Navigate to shipments list |
| Trace | `~Trace` | Navigate to pack/container trace |
| Delete Account | `~Delete Account` | Destructive — shows confirmation before acting |
| Logout | `~Logout` | Shows confirmation dialog |

## Navigation
- Entry: Landing → Sign In → Inspector home
- Logout: Tap **Logout** tile → confirm in dialog

## Key UI Patterns
- **Logout dialog:** “Are you sure you want to logout?” with Cancel + Confirm buttons
- **Trace screen:** two tabs — Pack (SGTIN) and Container (SSCC)
- **View Shipments:** scrollable list with status badges (Dispatched, Partially Delivered)

## Locators
| Element | Strategy | Selector |
|---------|----------|----------|
| View Shipments tile | accessibility id | `~View Shipments` |
| Trace tile | accessibility id | `~Trace` |
| Logout tile | accessibility id | `~Logout` |
| Delete Account tile | accessibility id | `~Delete Account` |

## Test Credentials
| Field | Value |
|-------|-------|
| Email | `testinspector@eptts.com` |
| Password | `Admin@123456` |

## Business Rules
- Inspector is **read-only** — cannot create, modify, or delete shipments or packs
- Has visibility across ALL parties (manufacturer, distributor, branch, pharmacy)
- Trace supports two identifier types: SGTIN (individual packs) and SSCC (containers)
- Shipment status visible to inspector: Dispatched, Partially Delivered, Delivered

