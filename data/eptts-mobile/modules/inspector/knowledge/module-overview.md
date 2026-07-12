<!-- generated-from-intake -->
# Inspector — Module Overview

## Overview

The Inspector module represents the regulatory/government auditor role within the EPTTS mobile app's serialized pharmaceutical supply chain (Manufacturer -> Distributor -> Branch -> Pharmacy -> Patient). An Inspector account (e.g. testinspector@eptts.com / Admin@123456) acts on behalf of the Egyptian Drug Authority (EDA) with read-only visibility across ALL supply-chain parties — it cannot create, modify, accept, reject, or delete shipments, packs, or returns. Its purpose is strictly investigative/compliance: browsing every shipment in the system regardless of which party created it, and tracing the full custody-transfer history of any individual pack (SGTIN) or container (SSCC) across the entire chain. The Inspector Home exposes the fewest tiles of any staff role (4, in a 2x2 grid), reflecting its narrower, oversight-only feature set compared to Distributor/Branch/Pharmacy.

## Roles involved

Inspector staff user — logs in via Keycloak Sign In with an inspector account (e.g. testinspector@eptts.com / Admin@123456); the home header shows the Keycloak account/entity name (e.g. 'Hello / System Admin Entity'). This is a single, undifferentiated read-only role — no sub-permissions or tiers are documented. The Inspector is explicitly the only role with cross-party visibility (all other roles see only their own entity's data).

## Main workflows

1) Inspector Home: Login with inspector credentials -> Home screen shows header 'Hello\nSystem Admin Entity' (multiline; entity name is the Keycloak account name) and 4 tiles in a 2x2 grid: View Shipments (top-left), Trace (top-right), Delete Account (bottom-left), Logout (bottom-right). Tiles are child `android.view.View` elements with content-desc but not directly clickable themselves — the parent view is clickable and the tap propagates. Tap any tile to navigate.

1a) Logout flow: tap Logout tile -> confirmation dialog appears with title 'Logout', body 'Are you sure you want to logout?', and Cancel / Confirm buttons (Confirm button shares the same content-desc 'Logout' as the home tile, but the dialog takes precedence while open; a gesture 'Dismiss' overlay also exists) -> tapping Confirm logs the user out and returns to the landing screen; tapping Cancel dismisses the dialog and keeps the user on Home.

2) View Shipments: Inspector Home -> View Shipments -> page title 'Shipments' with a Back button and a 'Filter by status' dropdown -> shipment cards (one composite content-desc per card, all fields joined by newline, e.g. '#test-96324100\nDispatched\nMain warehouse\nصيدليات الخليل\nItems: 1 • Packs: 6\n09/07/2026') covering shipments across ALL parties, sorted newest first -> tap a card -> 'Shipment Details' page: Back button, 'View Invoice' action button, field labels From/To/Items/Packs/Dispatched/Created (non-clickable), a 'Shipment Items' section header, and pack items showing an SSCC/GTIN value string (e.g. '035045800000002043') plus status (e.g. '6 pack(s) • in_transit'). Tapping the invoice reference opens the Invoice inline. No line-item drill-down beyond this level is available. Observed statuses: Dispatched, Delivered, Draft, Partially Delivered.

3) Trace: Inspector Home -> Trace -> page title 'Trace' with a Back button and two tabs — Pack (default/active) and Container. Pack tab: an 'Entity (optional)' filter dropdown (default 'All entities'), a scan circle (no content-desc, clickable android.view.View) with label 'Scan pack barcode' below it, an 'OR' divider, and an SGTIN input EditText with hint 'Enter SGTIN (GTIN + Serial)' (XPath //android.widget.EditText[@hint="Enter SGTIN (GTIN + Serial)"]), plus a 'Trace' primary action button. Container tab: same scan-circle pattern but an SSCC input EditText with hint 'Enter SSCC' (XPath //android.widget.EditText[@hint="Enter SSCC"]). Pack Trace happy path: tap Trace tab (default) -> tap the scan icon or type an SGTIN barcode -> tap Trace -> results list appears showing all supply-chain events for the pack (commissioning, shipping, receiving, dispensing), each showing event type, date/time, sender, receiver. Container Trace happy path: tap Container tab -> enter or scan an SSCC code -> tap Trace -> results show all events for that container/case.

4) Delete Account: destructive tile present on Inspector Home; expected (edge-case, not fully verified) to prompt a warning/confirmation dialog before the irreversible action, per the platform-wide Delete Account pattern shared with Branch.

## Business rules

Inspector is strictly read-only/investigative across the entire platform — cannot create, modify, accept, reject, or delete shipments, packs, or returns of any party. Shipment statuses visible to Inspector: Dispatched, Delivered, Draft, Partially Delivered (same status vocabulary as Distributor/Branch/Pharmacy, but Inspector sees shipments belonging to ALL parties, not just its own). Trace results return the FULL custody-transfer event history for a given SGTIN (pack) or SSCC (container), independent of which party currently holds/held it — this is the mechanism by which the Inspector performs cross-party audit. Invalid/unrecognised SGTIN or SSCC input should display an error ('Barcode not found' or similar, exact wording not fully verified); empty input should disable the Trace button or show a validation message; a valid barcode with no events should show an empty-state message; network errors should show a retry option. Pack count links in the shipment list (e.g. '1 packs', '18 packs') are tappable and open the serialised pack list. Session expiry (platform-wide 15-minute token, no auto-refresh) is expected to redirect the Inspector to the landing screen, though this has not been independently re-verified for the Inspector role specifically.

## Key fields & enums

- Shipment Status — Dispatched, Delivered, Draft, Partially Delivered
- SGTIN (Pack trace input) — Format GTIN + Serial Number; input hint 'Enter SGTIN (GTIN + Serial)'
- SSCC (Container trace input) — Input hint 'Enter SSCC'
- Entity filter (Trace) — Optional dropdown, default 'All entities'
- Trace result fields — Event type, date/time, sender, receiver — full custody-transfer history
- Shipment Detail fields — From, To, Items, Packs, Dispatched, Created, Shipment Items (SSCC/GTIN + status e.g. 'in_transit')
- Logout confirmation — Dialog: 'Are you sure you want to logout?' with Cancel / Confirm

## Open questions

Exact error message text for an invalid/unrecognised SGTIN or SSCC in Trace is not confirmed verbatim ('Barcode not found or similar' is explicitly hedged language in the source, i.e. TBD). Delete Account's confirmation dialog content/behavior for Inspector is described only as an expected edge case ('should prompt a warning dialog') rather than a verified observation — exact copy is unconfirmed. Whether the Inspector's Trace/View Shipments screens paginate or lazy-load for very large result sets is not documented. Whether session-expiry redirect-to-landing behavior has been independently verified for Inspector (vs. inferred from the platform-wide 15-minute-token rule documented for Distributor) is unconfirmed.
