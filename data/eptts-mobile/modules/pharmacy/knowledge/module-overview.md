<!-- generated-from-intake -->
# Pharmacy — Module Overview

## Overview

The Pharmacy module represents the last operational tier of the EPTTS mobile app's serialized pharmaceutical supply chain before the Patient (Manufacturer -> Distributor -> Branch -> Pharmacy -> Patient). A Pharmacy account (e.g. sydybishresaaf@eptts.com / Admin@123456) receives inbound stock from a distributor or branch, dispenses individual serialised packs to patients (the terminal supply-chain event), and both initiates upstream returns (Return Pack, to distributor/manufacturer) and accepts downstream returns (Branch Return, from a branch back into pharmacy inventory). It also tracks its own return history (My Returns) and compliance event log (EPCIS History). The Pharmacy Home displays 6 tiles and the registered GLN entity name of the pharmacy in the header (e.g. 'PH Sydy Bishr esaaf 24'), and, uniquely among captured roles, shows no Logout tile in the current build.

## Roles involved

Pharmacy staff user — logs in via Keycloak Sign In with a pharmacy account (e.g. sydybishresaaf@eptts.com / Admin@123456); the pharmacy's registered GLN entity name is displayed in the home header (e.g. 'PH Sydy Bishr esaaf 24'). No sub-roles are documented; all pharmacy users see the same 6-tile home screen and can perform all pharmacy operations (receive invoice, dispense, return pack, branch return, my returns, EPCIS history).

## Main workflows

1) Pharmacy Home: Login with pharmacy credentials -> Home screen shows the pharmacy name header (e.g. 'PH Sydy Bishr esaaf 24') and 6 tiles: Receive Invoice (accept incoming stock from a distributor/branch), Dispense (record dispensing to a patient), Return Pack (return a pack upstream to distributor/manufacturer), Branch Return (process a return sent from a branch), My Returns (view history of initiated returns), EPCIS History (view supply-chain event log). No Logout tile is visible on the pharmacy home in the captured build.

2) Receive Invoice: Pharmacy Home -> Receive Invoice -> 'Incoming Invoices' list: cards show invoice number, sender name (down arrow), pack count (tappable), date, and status badge (Dispatched, Partially Delivered) -> tap an invoice card -> Receive Shipment screen: summary card (Invoice #, From, To, Items, Packs), Scan Progress card (progress bar + 'X / Y' counter + percentage, starting at 0%), 'Scan Barcode' button opening the camera scanner, Scanned tab and Remaining tab -> tap Scan Barcode -> scan each pack barcode on the physical product -> each successful scan increments the progress counter (e.g. 1/3, 2/3) and moves the pack into the Scanned tab; Remaining tab shows outstanding packs -> when all packs are scanned (100%), the shipment can be confirmed/submitted. 'Scanned (0)'/'Remaining (0)' tabs update in real time.

3) Dispense: Pharmacy Home -> Dispense -> screen opens with a barcode scanner prompt (scan/barcode area) -> tap the scan area, point the camera at the pack's GS1/SGTIN barcode -> app reads the barcode and validates that the pack is in this pharmacy's inventory -> confirm the dispense action -> success confirmation shown; the pack is marked as dispensed in the system -> tap back to return to Pharmacy Home. This is the terminal/closing event in the pharmaceutical supply chain for the pharmacy-to-patient leg; each dispense generates an EPCIS 'DISPENSING' event visible in EPCIS History.

4) Return Pack (pharmacy-to-upstream): Pharmacy Home -> Return Pack -> screen with a scan area ('Tap to scan pack / SSCC') and an optional 'Note (optional)' text field -> tap the scan area, scan the pack's GS1/SGTIN barcode -> optionally type a return reason in the Note field -> tap 'Initiate Return' -> success confirmation shown; the return request is created and will appear in My Returns -> return to Pharmacy Home. This flow is distinct from Branch Return (which is downstream-to-pharmacy, not pharmacy-to-upstream).

5) Branch Return (pharmacy-side of the branch-to-pharmacy loop): Pharmacy Home -> Branch Return -> screen shows pending returns from branch(es) (incoming returns list) -> select a return to process -> scan each returned pack barcode to verify them against the return -> confirm receipt — packs are moved back into pharmacy inventory -> return to Pharmacy Home. Distinct from Return Pack, which sends packs upstream instead of accepting them from a branch.

6) My Returns: Pharmacy Home -> My Returns -> Returns list showing all return requests initiated by this pharmacy; a Filter dropdown narrows by status; each card shows Return number (e.g. RET-2026-000019), From (source GLN), To (destination GLN), Items count, Created date, and status badge (CONFIRMED green, PENDING yellow/orange, CANCELLED red) -> tap a return card to view its detail.

7) EPCIS History: Pharmacy Home -> EPCIS History -> Status dropdown (default 'All statuses') -> event list (ordered by event time, newest first) with cards showing a truncated event hash ID (UUID), event type (SHIPPING, RECEIVING, UNPACKING, or DISPENSING — the pharmacy is the only role whose EPCIS History includes DISPENSING events), Sender, Receiver, Items count, Event Time, and status badge (Completed green, Failed red) -> for Failed entries, tap the whole card ('View event errors' text is embedded in the card's composite content-desc, not a separate element) -> an error detail bottom sheet opens (not a new page): shows the event UUID title, per-sequence entries (Sequence#, event type, error code e.g. INTEGRITY_ERROR, error message), and a Close (x) button. Both the pharmacy's own events (as sender or receiver) appear in the list. Failed events include a '1 of N events failed' summary.

## Business rules

Invoice/shipment status badges observed in Receive Invoice: Dispatched, Partially Delivered — a partial receipt (submitting before all packs scanned) results in a 'Partially Delivered' outcome. Return statuses: CONFIRMED (green), PENDING (yellow/orange), CANCELLED (red) — cancelled returns cannot be reactivated; return numbers follow the RET-YYYY-NNNNNN format. EPCIS event statuses: Completed (green) vs Failed (red), with Failed carrying a structured error code + message surfaced only via bottom sheet, never full-page navigation. Receive Invoice validation: scanning a barcode that doesn't belong to this shipment shows 'Pack not in this shipment'; scanning a duplicate pack shows 'Already scanned'; network errors during scan show a graceful error with retry; an empty invoice list shows an empty-state message. Dispense validation: a pack not in pharmacy inventory shows 'Pack not found in your stock'; a pack already dispensed shows 'Pack has already been dispensed'; a recalled/flagged pack should show a warning before allowing dispense; invalid barcode format shows a scan error; network errors show a graceful error with retry. Return Pack validation: invalid/unrecognised barcode shows an error; pack not in pharmacy inventory shows an error; pack already returned shows an error; the Note field is optional and must not block submission when empty; network errors show a retry option. Branch Return validation: no pending branch returns shows an empty-state message; a scanned pack that doesn't match the return shows an error; partial-acceptance behavior (not all packs scanned before confirming) is called out as needing validation/unclear. My Returns validation: an empty list shows an empty-state message; filtering with no matches shows an empty filtered state. EPCIS History: failed events show a 'N of N events failed' summary + 'View event errors' embedded link; empty list and network-error/retry states are expected; filtering by Failed with no failures shows an empty filtered state.

## Key fields & enums

- Invoice/Shipment Status — Dispatched, Partially Delivered (Receive Invoice context)
- Return # — RET-YYYY-NNNNNN format, e.g. RET-2026-000019
- Return Status — CONFIRMED (green), PENDING (yellow/orange), CANCELLED (red)
- Note (return reason) — Optional free text on Return Pack
- EPCIS Event Type — SHIPPING, RECEIVING, UNPACKING, DISPENSING (pharmacy is the only role observed emitting DISPENSING)
- EPCIS Event Status — Completed (green), Failed (red)
- EPCIS Error Code — e.g. INTEGRITY_ERROR
- Scan Progress — X/Y counter + percentage; Scanned(n)/Remaining(n) tabs, real-time update
- Pharmacy header name — Registered GLN entity name, e.g. 'PH Sydy Bishr esaaf 24'

## Open questions

No Logout tile is visible on Pharmacy Home in the captured build — the workflow.md explicitly flags this as unresolved: 'logout is accessed elsewhere (possibly via a settings/menu area, or the tile is not captured in screenshots yet)'. Branch Return's partial-acceptance behavior (confirming receipt when not all returned packs have been scanned) is explicitly called out as 'needs validation' / unverified. The exact validation-error copy for Dispense on a recalled/flagged pack is described as an expected warning but not verified verbatim. My Returns for Pharmacy only documents CONFIRMED and CANCELLED as observed statuses in test data (PENDING is listed in the UI Elements table as a possible badge color but not confirmed present in actual observed test-data rows).
