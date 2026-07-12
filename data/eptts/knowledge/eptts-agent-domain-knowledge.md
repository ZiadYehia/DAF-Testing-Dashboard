Masar Agent — Comprehensive Domain Knowledge & System Understanding
1. System Overview

Masar Agent is a desktop pharmacy application integrated with the Masar Track & Trace ecosystem.

The Agent is responsible for handling serialized pharmaceutical operations inside pharmacies, including:

Receiving products
Selling/dispensing products
Returning products
Synchronizing transactions with Masar backend services
Managing serialized inventory states

The system is based on pharmaceutical traceability and GS1 serialization standards.

2. Main Business Objective

The main purpose of the Agent is to:

Track every pharmaceutical pack individually
Prevent duplicate ownership of packs
Maintain accurate lifecycle states for serialized products
Ensure all product movements are traceable
Synchronize pharmacy actions with the central Masar system

The Agent acts as the execution layer for pharmacy operations.

3. Core GS1 & Serialization Concepts
3.1 GLN (Global Location Number)

GLN identifies a physical business location.

Examples:

Pharmacy GLN
Distributor GLN
Warehouse GLN

Important rule:
A serialized pack must belong to only one GLN at a time.

The pharmacy opened in the Agent is linked to a specific GLN.

3.2 GTIN (Global Trade Item Number)

GTIN identifies the product type itself.

Examples:

Panadol 500mg
Augmentin 1g

GTIN does NOT identify an individual pack.
It identifies the product model/type.

3.3 Serial Number (SSN)

Each pharmaceutical pack has a unique serial number.

Even if two packs are the same product:

Same GTIN
Same batch
Same expiry

They still have different serial numbers.

3.4 DataMatrix

Serialized pharmaceutical barcode containing:

GTIN
Serial Number
Batch Number
Expiry Date

The Agent mainly operates using:

Scan
or
Copy/paste of DataMatrix value
3.5 SSCC (Serial Shipping Container Code)

SSCC identifies a shipping container/carton.

One SSCC may contain:

Multiple packs
Multiple serial numbers

SSCC represents aggregation of packs.

4. Main Agent Functional Modules
4.1 Authentication & Activation

Flow:

User login
OTP verification
Activation key validation
Device linking
Pharmacy/GLN loading

Important rules:

Activation key is one-time use
Activation key has expiration
Same activation key cannot be used simultaneously on multiple devices
Device is linked to pharmacy context
4.2 Receive Module

Purpose:
Convert products from:
InTransit → Active

Receive methods:

Receive by SSCC
Receive by single pack

No partial receive is supported.

4.3 Sell / Dispense Module

Purpose:
Convert products from:
Active → Dispensed
or
Active → Partial Dispensed

Modes:

Pack Mode
Strip Mode

User manually enters quantity after adding product.

The system shows maximum allowed quantity.

4.4 Return Module

Supports:

Return from user to pharmacy
Return from pharmacy to distributor

Returns depend on:

Current pack state
GLN ownership
Previous dispense history
4.5 Products Module

Products tab displays:

Product master data
Product catalog

It does NOT necessarily represent actual pharmacy inventory.

Contains:

Product types
Product definitions
Metadata
4.6 Queue Module

Technical synchronization log.

Displays:

Pending transactions
Failed transactions
Synced transactions
Retry attempts
Sync status

Queue supports:

Retry
Resync
4.7 History Module

Business transaction log.

Contains:

Receive operations
Sell operations
Return operations
Failed business actions if applicable

History represents business actions, not synchronization state.

5. Product Lifecycle & State Machine
Typical Lifecycle
Manufacturing

Pack created.

↓

Distribution

Pack shipped.

↓

Pharmacy Shipment

Pack becomes:
InTransit

↓

Receive

Pack becomes:
Active

↓

Dispense/Sell

Pack becomes:
Dispensed
or
Partial Dispensed

↓

Return

Pack may move to returned state depending on business rules.

6. Known Product States

Possible states include:

State	Description
InTransit	Product shipped to pharmacy but not received
Active	Product available for dispensing
Dispensed	Product fully sold
Partial Dispensed	Product partially sold
Returned	Product returned
Expired	Product expired
Decommissioned	Product removed from active circulation
7. Receive Domain Rules
Receive Preconditions

A pack can be received only if:

It belongs to correct GLN
It exists in Masar
It is in valid state
It is not already received
It is not expired
Receive by SSCC

Receiving SSCC should:

Activate all inner packs
Update states correctly
Reflect in Queue and History
Receive by Single Pack

Receiving individual packs should:

Activate pack
Validate Pack URN
Validate ownership/state

Known issue:
Single pack receive may fail with:
Pack URN not found

while SSCC receive succeeds.

8. Sell / Dispense Domain Rules
Sell Preconditions

A pack can be sold only if:

State = Active
Pack belongs to same pharmacy GLN
Pack is not expired
Pack is not already dispensed
Pack Mode

Dispenses entire pack.

Strip Mode

Dispenses partial quantity from pack.

Examples:

Strips
Tablets
Important Business Rule

After partial strip dispense:

Full pack dispense may no longer be allowed

This area is considered high risk.

9. Return Domain Rules
Return From User To Pharmacy

Allowed when:

Product was dispensed previously
Product belongs to same pharmacy GLN
Product state allows return

Applicable states:

Dispensed
Partial Dispensed
Return From Pharmacy To Distributor

Used for:

Damaged products
Expired products
Recall operations
Unsellable products
10. Offline Architecture

The Agent supports offline operations.

Offline supported operations:

Receive
Sell
Return

Offline actions:

Update UI immediately
Update counters immediately
Save locally
Enter Queue as pending
11. Synchronization Architecture
Offline Flow

Offline action performed

↓

Transaction stored locally

↓

Queue status = Pending

↓

Internet restored

↓

Automatic or manual sync

↓

Queue status = Synced

Sync Failure Handling

Failed sync should:

Remain visible
Support retry
Preserve transaction integrity
Avoid duplicate business actions
12. Queue vs History Difference
Queue

Technical synchronization tracking.

Tracks:

Pending
Failed
Synced
Retry attempts
History

Business operation tracking.

Tracks:

Receives
Sells
Returns
13. Product Addition & Updates

When products are added or updated in Masar:

Products should appear correctly in Agent
Product metadata should sync correctly
Products should work online
Products should work offline
No sync corruption should occur

Known risk:
Product count mismatch between Masar and Agent.

14. Session & Activation Behavior

Expected behavior:

App restart should preserve session
App restart should preserve activation
Pending queue should persist

Known actual issue:

App asks for login/activation again after reopening
15. Device Linking & Deactivation Rules

Expected behavior:
If:

Pharmacy deactivated
or
Device unlinked

Then:

User should be force logged out
New operations should be blocked immediately

Known issue:
Operations may continue even after deactivation/unlink.

16. Core Validation Rules
Receive Validation

Reject:

Wrong GLN
Invalid DataMatrix
Expired product
Duplicate receive
Invalid state
Sell Validation

Reject:

InTransit products
Wrong GLN
Expired product
Invalid quantity
Quantity > max
Invalid DataMatrix
Return Validation

Reject:

Never-dispensed products
Wrong GLN
Already returned products
Invalid states
17. Duplicate Protection Rules

The Agent should prevent:

Same DataMatrix added twice in same operation
Same SSCC added twice
Duplicate synchronization
Same serialized pack existing in multiple GLNs
18. Transaction Flow Behavior

All main operations:

Receive
Sell
Return

Follow similar workflow:

Copy/paste or scan DataMatrix
Product auto-added
User adjusts quantity if needed
Confirm transaction
Transaction appears in Queue
Transaction appears in History
19. Quantity Rules

Quantity is manually selected by user.

The system provides:

Maximum allowed quantity

Quantity logic differs between:

Pack mode
Strip mode
20. Important High-Risk Areas
20.1 Serialization Integrity

Critical risk:
Same serialized pack appearing in multiple locations.

20.2 State Transition Integrity

Invalid transitions must be blocked.

Examples:

Selling InTransit pack
Returning non-dispensed pack
20.3 Sync Duplication

Retry/reconnect must not create duplicate business actions.

20.4 Offline/Online Inconsistency

Local state and backend state must remain consistent.

20.5 SSCC Aggregation Integrity

Receiving SSCC must correctly affect all inner packs.

20.6 Strip/Pack Rule Corruption

Partial dispense should correctly affect future operations.

20.7 Session Persistence

Restart should not lose authentication or queue state.

21. Known Existing Issues
Functional Issues
Product list count mismatch between Agent and Masar
Single pack receive fails with "Pack URN not found"
Strip/Pack business rule inconsistencies
Security/Session Issues
Session lost after restart
Activation requested again after reopen
Deactivation does not force logout
Device unlink does not block operations
22. Important Technical Terms
Term	Meaning
URN	Unique serialized identifier
DataMatrix	Serialized barcode
Serialization	Unique pack tracking
Traceability	Lifecycle tracking
Dispense	Sell operation
Decommission	Remove from circulation
Aggregation	Linking packs to SSCC
Sync	Upload local transactions
Retry	Reattempt failed synchronization
23. Likely Backend Architecture

Likely components:

Local Agent database/cache
Queue worker
Sync engine
Masar APIs
Product master service
Authentication service
Serialization validation service
Transaction service
24. Testing Philosophy For Masar Agent

Masar Agent is NOT a simple CRUD application.

Testing must focus on:

Serialization integrity
Lifecycle transitions
State machine correctness
Ownership validation
Synchronization correctness
Offline reliability
Queue consistency
Traceability integrity
Aggregation integrity
Data consistency between Agent and backend

The most important aspect is ensuring serialized pharmaceutical packs always maintain:

Correct state
Correct ownership
Correct traceability history
Correct synchronization status