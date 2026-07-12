# Pharmacy Home — Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Pharmacy Home |
| **Slug** | `pharmacy-home` |
| **Module** | Pharmacy |
| **Navigation Path** | Landing → Sign In (pharmacy credentials) → Home |
| **Priority** | P1 |

## Business Purpose

The home screen for the Pharmacy role. Displays the pharmacy's name in the header and provides tile-based navigation to all pharmacy workflows — receiving stock, dispensing to patients, processing returns, and viewing EPCIS compliance history.

## UI Elements

| Element | Type | Content-Desc |
|---------|------|--------------|
| Pharmacy name header | Label | e.g. "PH Sydy Bishr esaaf 24" |
| Receive Invoice tile | Navigation card | `~Receive Invoice` |
| Dispense tile | Navigation card | `~Dispense` |
| Return Pack tile | Navigation card | `~Return Pack` |
| Branch Return tile | Navigation card | `~Branch Return` |
| My Returns tile | Navigation card | `~My Returns` |
| EPCIS History tile | Navigation card | `~EPCIS History` |

## Happy Path

1. User authenticates with pharmacy credentials (`sydybishresaaf@eptts.com`).
2. Pharmacy home screen appears with the pharmacy name in the header (e.g. **"PH Sydy Bishr esaaf 24"**).
3. **6 tiles** are visible in a grid:
   - **Receive Invoice** — accept incoming stock from a distributor/branch
   - **Dispense** — record dispensing to a patient
   - **Return Pack** — return a pack upstream
   - **Branch Return** — process a return from a branch
   - **My Returns** — view the history of initiated returns
   - **EPCIS History** — view supply-chain event log
4. Tap any tile to navigate to that feature.

## Notes

- The pharmacy name in the header is the registered GLN name for the pharmacy account.
- No Logout tile on the pharmacy home — logout is accessed elsewhere (possibly via a settings/menu area, or the tile is not captured in screenshots yet).
