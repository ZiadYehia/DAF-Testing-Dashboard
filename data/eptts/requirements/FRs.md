# EPTTS Agent — Functional Requirements

| no | Role | Feature ID | Feature | Priority | Status |
|----|------|------------|---------|----------|---------| 
| 1 | Pharmacy User | EPTTS_FR_01 | Authentication — Login (Email + Password + Server URL) | P1 | Not Started |
| 2 | Pharmacy User | EPTTS_FR_02 | Authentication — OTP Verification (6-digit email code) | P1 | Active |
| 3 | Pharmacy User | EPTTS_FR_03 | Authentication — Activation Key Validation | P1 | Not Started |
| 4 | Pharmacy User | EPTTS_FR_04 | Authentication — Session & Device Persistence | P1 | Active |
| 5 | Pharmacy User | EPTTS_FR_05 | Authentication — Pharmacy & GLN Context Loading | P1 | Active |
| 6 | Pharmacy User | EPTTS_FR_06 | Authentication — Forced Logout on Deactivation / Device Unlink | P1 | Active |
| 7 | Pharmacy User | EPTTS_FR_07 | Receive — Receive by Single Pack (DataMatrix) | P1 | Active |
| 8 | Pharmacy User | EPTTS_FR_08 | Receive — Receive by SSCC (Shipping Container) | P1 | Active |
| 9 | Pharmacy User | EPTTS_FR_09 | Receive — State Transition InTransit → Active | P1 | Active |
| 10 | Pharmacy User | EPTTS_FR_10 | Sell — Sell by Pack Mode (Full Pack) | P1 | Not Started |
| 11 | Pharmacy User | EPTTS_FR_11 | Sell — Sell by Strip Mode (Partial Quantity) | P1 | Active |
| 12 | Pharmacy User | EPTTS_FR_12 | Sell — State Transition Active → Dispensed / Partial Dispensed | P1 | Active |
| 13 | Pharmacy User | EPTTS_FR_13 | Return — Return Pack from Patient to Pharmacy | P2 | Active |
| 14 | Pharmacy User | EPTTS_FR_14 | Return — State Transition Dispensed / Partial Dispensed → Returned | P2 | Active |
| 15 | Pharmacy User | EPTTS_FR_15 | Return to Distributor — Return Active Pack to Branch | P2 | Active |
| 16 | Pharmacy User | EPTTS_FR_16 | Return to Distributor — SSCC Return to Branch | P2 | Active |
| 17 | Pharmacy User | EPTTS_FR_17 | Return to Distributor — State Transition Active → InTransit (pending branch approval) | P2 | Active |
| 18 | Pharmacy User | EPTTS_FR_18 | Queue — Transaction Sync (Pending → Synced) | P1 | Execution |
| 19 | Pharmacy User | EPTTS_FR_19 | Queue — Retry Failed Transaction | P1 | Execution |
| 20 | Pharmacy User | EPTTS_FR_20 | Queue — Offline Operation (Save Locally → Sync on Reconnect) | P1 | Execution |
| 21 | Pharmacy User | EPTTS_FR_21 | Settings — Overview (Counters, Sync Now, Export Log, Test Connection) | P3 | Execution |
| 22 | Pharmacy User | EPTTS_FR_22 | Settings — Products Catalog (Search, Refresh) | P3 | Execution |
| 23 | Pharmacy User | EPTTS_FR_23 | Settings — History Log (Filter by Transaction Type) | P2 | Execution |
| 24 | Pharmacy User | EPTTS_FR_24 | Settings — Keyboard Shortcuts (Customizable Bindings) | P3 | Execution |
