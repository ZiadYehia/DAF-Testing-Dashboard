# Pharmacy Module — Domain Knowledge

## Role
Login with a **Pharmacy** account (`sydybishresaaf@eptts.com` / `Admin@123456`). The Pharmacy is the **last point** in the supply chain before the product reaches the patient.

## Business Purpose
Pharmacies receive serialised pharmaceutical products from distributors/branches, dispense them to patients, and manage returns. Every action triggers EPCIS events that are submitted to the national EPTTS registry.

## Features

| Feature | Slug | Description |
|---------|------|-------------|
| Pharmacy Home | `pharmacy-home` | 6-tile home grid |
| Receive Invoice | `pharmacy-receive-invoice` | Accept incoming shipments via barcode scanning |
| Dispense | `pharmacy-dispense` | Record dispensing a pack to a patient |
| Return Pack | `pharmacy-return-pack` | Initiate return of a pack upstream (to distributor) |
| Branch Return | `pharmacy-branch-return` | Accept returns coming in from branches |
| My Returns | `pharmacy-my-returns` | View history of return requests |
| EPCIS History | `pharmacy-epcis-history` | View all EPCIS events for this pharmacy |

## Home Screen Tiles
| Tile | Content-Desc | Colour |
|------|-------------|--------|
| Receive Invoice | `~Receive Invoice` | — |
| Dispense | `~Dispense` | — |
| Return Pack | `~Return Pack` | — |
| Branch Return | `~Branch Return` | — |
| My Returns | `~My Returns` | — |
| EPCIS History | `~EPCIS History` | — |

## Pharmacy Identity
- The pharmacy name is displayed in the home screen header (e.g. **"PH Sydy Bishr esaaf 24"**)
- Name is the registered GLN entity name for the pharmacy account

## Supply Chain Position
```
Manufacturer → Distributor → Branch → [Pharmacy] → Patient
```

## Key UI Patterns
- **Receive Invoice:** invoice list → scan screen with progress bar (0/N)
- **Dispense:** scan pack barcode → confirm
- **Return Pack / Manufacturer Return:** scan + optional note + Initiate Return
- **My Returns list:** RET-YYYY-NNNNNN format, statuses: CONFIRMED, CANCELLED
- **EPCIS History:** Status filter, event types: SHIPPING, RECEIVING, UNPACKING, DISPENSING

## Shared Scanner Component
- Circular scan button with QR frame icon
- Scanned/Remaining tabs with live counter
- Progress bar (0% → 100%) with X/Y count

## Test Credentials
| Field | Value |
|-------|-------|
| Email | `sydybishresaaf@eptts.com` |
| Password | `Admin@123456` |

## Business Rules
- A pack must be in the pharmacy’s inventory before it can be dispensed
- Dispensing a pack generates a terminal EPCIS event (pack exits the tracked supply chain)
- Receive Invoice: scanned packs are verified against the invoice manifest
- Returns: note is optional; barcode scan is required
- Return statuses: CONFIRMED, CANCELLED, PENDING

