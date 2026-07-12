<!-- generated-from-intake -->
# EPTTS Agent — Platform & Domain Knowledge

## What this product is

Masar Agent (also called EPTTS Agent) is a desktop pharmacy application (Windows) integrated with the Masar Track & Trace ecosystem. It is the execution layer for pharmacy-side serialized pharmaceutical operations: receiving products from distributors/warehouses, selling/dispensing products to patients, returning products (patient-to-pharmacy and pharmacy-to-distributor/branch), and synchronizing all transactions with the central Masar backend. The system is built on pharmaceutical traceability and GS1 serialization standards. Its core business objectives are: track every pharmaceutical pack individually by serial number; prevent duplicate ownership of packs across locations; maintain accurate lifecycle states for serialized products (InTransit, Active, Dispensed, Partial Dispensed, Returned, Expired, Decommissioned); ensure all product movements are fully traceable; and keep pharmacy actions synchronized with the central Masar system, including while offline. Masar Agent is explicitly NOT a simple CRUD application — testing philosophy centers on serialization integrity, lifecycle/state-machine correctness, ownership validation (GLN), synchronization correctness, offline reliability, queue consistency, and traceability/aggregation integrity rather than basic form validation alone.

## User roles

- Pharmacy User — The only user role in the system — Masar Agent has NO role system and no Owner/Manager/Pharmacist/Inspector distinctions. A single authenticated pharmacy user, after login, OTP verification, and (when enabled) activation key validation, gets full access to all modules tied to their pharmacy's GLN (Global Location Number) context: Receive, Sell/Dispense, Return, Return to Distributor, Queue, History, Products/Settings. All operations are scoped to the pharmacy GLN the device is linked to. Access control is enforced not via role permissions but via device/pharmacy activation state — if the pharmacy is deactivated or the device is unlinked from the Masar backend, the user should be force-logged-out and blocked from new operations (this is a known defect area, see Known Issues).

## Core concepts & entities

- GLN (Global Location Number) — Identifies a physical business location (pharmacy GLN, distributor GLN, warehouse GLN). A serialized pack must belong to only one GLN at a time. The pharmacy opened in the Agent is linked to a specific GLN, and all pack ownership/validation rules are checked against this GLN.
- GTIN (Global Trade Item Number) — Identifies the product type/model itself (e.g., Panadol 500mg, Augmentin 1g). Does NOT identify an individual pack — multiple packs share the same GTIN.
- Serial Number (SSN) — Unique identifier for each individual pharmaceutical pack. Two packs can share the same GTIN, batch, and expiry but still have different serial numbers — this is what makes each pack individually traceable.
- DataMatrix — The serialized pharmaceutical barcode encoding GTIN, Serial Number, Batch Number, and Expiry Date, in the format `01{GTIN}21{SSN}10{Batch}17{Expiry}`. The Agent primarily consumes this via barcode Scan or Copy/Paste of the DataMatrix value.
- SSCC (Serial Shipping Container Code) — Identifies a shipping container/carton that aggregates multiple packs/serial numbers. Represents an aggregation relationship — receiving or returning an SSCC should correctly propagate to all inner packs.
- Pack / Product (serialized item) — An individual serialized pharmaceutical unit that moves through a lifecycle state machine: Manufacturing → Distribution → Pharmacy Shipment (InTransit) → Receive (Active) → Dispense/Sell (Dispensed / Partial Dispensed) → Return (Returned), with Expired and Decommissioned as terminal/exception states.
- Products Module — Displays product master data / product catalog (product types, definitions, metadata). Does NOT necessarily represent actual pharmacy inventory — this is the source of a known product-count-mismatch defect area (Agent vs Masar).
- Queue Module — Technical synchronization log. Displays Pending, Failed, and Synced transactions plus retry attempts/sync status. Supports Retry and Resync actions. Represents synchronization state, not business state.
- History Module — Business transaction log recording Receive, Sell, and Return operations (and failed business actions where applicable). Represents completed business actions, distinct from Queue's sync-state tracking.
- Settings Module — Contains Overview (counters, Sync Now, Export Log, Test Connection, Server Address), Products Catalog (search/refresh), History Log (filter by transaction type), and Keyboard Shortcuts (customizable bindings) tabs/panels. Also where the Masar API Server Address can be viewed/changed.
- Activation Key — One-time-use key with an expiration date that validates a specific device is authorized for a given pharmacy/GLN. Cannot be used simultaneously on multiple devices. Currently disabled in the live flow per the Authentication workflow doc, but still part of the functional requirements and validation rules.
- Transaction — A Receive, Sell, or Return business action performed against one or more packs. Every transaction follows: scan/paste DataMatrix → product auto-added → user adjusts quantity if needed → confirm → appears in Queue → appears in History.

## Key workflows

AUTHENTICATION FLOW: User launches the app on Windows → Login screen (Email + Password fields, collapsible '▼ Advanced' section with pre-filled Server URL, e.g. https://masar-api.v2.daf-holding.com, editable) → user enters email/password → clicks Sign In → OTP Verification screen appears ('A 6-digit code was sent to your email {email}') with 6 individual digit boxes → user retrieves code from email and enters it → clicks Verify → (Activation Key step — currently disabled in the live build, but defined: app would prompt for a one-time activation key tied to the pharmacy/GLN, validate it, and link the device) → Main Screen loads with mode buttons SELL / RECEIVE / RETURN / RTN BRANCH, sync status '✓ All synced', and pharmacy name/Email/Location ID (GLN) visible under Settings → Overview. Validation: empty email/password blocks Sign In; invalid credentials show an error and keep user on Login; wrong/expired OTP shows an error (Resend Code invalidates the prior code); reused/expired/multi-device activation keys are rejected; unreachable Server URL blocks Sign In with a network error.

RECEIVE FLOW (InTransit → Active): User switches to RECEIVE mode (Ctrl+2) → opens the hidden scan input field (double-click white border area) → scans or pastes DataMatrix (single pack) or an SSCC barcode (multiple aggregated packs) → item(s) added to a scanned list and item counter increments → user can clear the list (Ctrl+Shift+X) before confirming → confirms the transaction (click item counter or Ctrl+Shift+D) → pack state(s) change from InTransit to Active, the 'In' counter in the counters bar increments, and the transaction appears in History and Queue (Synced, or Pending if offline). No partial receive is supported — an SSCC either receives fully or is rejected if any inner pack is in an invalid state (behavior TBD with PO per test notes). Receive can happen by SSCC (activates all inner packs) or by single pack (validates Pack URN/ownership/state) — single-pack receive has a known defect: 'Pack URN not found' error even for valid InTransit packs belonging to the correct GLN. Preconditions for a valid receive: correct GLN, pack exists in Masar, valid state, not already received, not expired, not a duplicate DataMatrix/SSCC within the same transaction.

SELL / DISPENSE FLOW (Active → Dispensed or Partial Dispensed): User switches to SELL mode → scans/pastes DataMatrix of an Active pack → selects Pack Mode (dispense entire pack) or Strip Mode (dispense partial quantity, e.g., a number of strips/tablets) → manually enters/adjusts quantity (system shows the maximum allowed quantity) → confirms transaction → pack state changes to Dispensed (full) or Partial Dispensed (partial), transaction appears in History and Queue. Key business rule (high risk area): after a partial strip dispense, a subsequent full-pack dispense on the same pack may no longer be allowed — this area has known bugs (e.g., pack in Active state incorrectly reported as already dispensed; partial dispense failing to sync with Masar when performed twice; full-pack dispense allowed after a partial dispense already occurred). Preconditions: pack must be Active, belong to the same pharmacy GLN, not expired, not already dispensed; system must reject InTransit packs, wrong-GLN packs, expired packs, invalid/negative/zero/decimal quantities, and quantities exceeding the max.

RETURN FLOW — Patient to Pharmacy (Dispensed/Partial Dispensed → Returned): Allowed only for packs previously dispensed, belonging to the same pharmacy GLN, and in a state that permits return. Rejects never-dispensed products, wrong-GLN packs, and already-returned packs.

RETURN TO DISTRIBUTOR FLOW — Pharmacy to Distributor/Branch (Active → InTransit pending branch approval): Used for damaged, expired, recalled, or unsellable products; supports both single-pack and SSCC return. Known defects include: agent allows returning an InTransit pack to distributor with a success message when it should be rejected; agent rejects return-to-distributor for an expired pack instead of allowing it; keyboard shortcut Ctrl+4 fails to navigate to the Return to Distributor module; and a validation message bug where sourceList/destinationList incorrectly report containing the same GLN.

QUEUE / SYNCHRONIZATION FLOW: Offline action performed → UI/counters update immediately and the transaction is saved locally → Queue status = Pending → internet restored → automatic or manual sync (Sync Now in Settings → Overview) → Queue status = Synced, and the corresponding pack state/History record is finalized. Failed syncs must remain visible, support Retry, preserve transaction integrity, and must never create duplicate business actions in Masar on retry/reconnect. All three core operations (Receive, Sell, Return) are supported offline.

PRODUCT CATALOG SYNC: When products are added/updated in Masar, they should sync correctly into the Agent's Products/Settings catalog (search, refresh) both online and offline without corruption; known defects exist around product count mismatches between the Agent's Products tab and Masar, and around sync toast notifications showing total product count instead of only new/changed products.

SESSION / DEVICE LIFECYCLE: App restart should preserve session, activation, and pending queue state (known defect: app currently re-prompts for login/activation after reopening). If the pharmacy is deactivated or the device is unlinked, the user should be force-logged-out and blocked from new operations immediately (known defect: operations may continue after deactivation/unlink).

## Environments & access

- Production Masar API (default Server URL, pre-filled in app Advanced settings): https://masar-api.v2.daf-holding.com
- Test/QA Masar API (used in Settings → Server Address test cases): https://test-masar-api.v2.daf-holding.com
- Desktop application platform: N/A — Windows 10/11 native desktop app (Masar Agent v2.3.5 in current test cases; some logged bugs reference v2.4.0), no browser URL

## Glossary

- GLN — Global Location Number — identifies a physical business location (pharmacy, distributor, warehouse); a pack belongs to only one GLN at a time
- GTIN — Global Trade Item Number — identifies the product type/model, not an individual pack
- SSN — Serial Number — unique identifier of an individual pharmaceutical pack
- DataMatrix — Serialized pharmaceutical barcode encoding GTIN, Serial Number, Batch Number, and Expiry Date
- SSCC — Serial Shipping Container Code — identifies a shipping container aggregating multiple packs
- URN — Unique serialized identifier used internally to reference a pack (e.g., 'pack urn:epc:id:sgtin:...')
- Serialization — Unique pack-level tracking using GTIN + Serial Number + Batch + Expiry
- Traceability — Ability to track a pack's full lifecycle history
- Dispense — Synonym for the Sell operation — converting Active stock to Dispensed/Partial Dispensed
- Decommission — Removing a pack from active circulation
- Aggregation — The relationship linking individual packs to an SSCC container
- Sync — Uploading locally-stored offline transactions to the Masar backend
- Retry — Reattempting a failed synchronization from the Queue
- InTransit — Product state: shipped but not yet received at the current GLN
- Active — Product state: received and available for dispensing
- Dispensed / Partial Dispensed — Product state: fully or partially sold to a patient
- Returned — Product state: returned (from patient or to distributor)
- Pack Mode vs Strip Mode — Sell sub-modes: Pack Mode dispenses the entire pack; Strip Mode dispenses a partial quantity (strips/tablets)
- RTN BRANCH — Main-screen mode button label for the Return to Distributor module
- Queue vs History — Queue = technical sync-state log (Pending/Failed/Synced/Retry); History = business transaction log (Receive/Sell/Return records)
