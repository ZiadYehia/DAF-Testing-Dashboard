# Dawana Platform — Comprehensive Knowledge Base

> This document is based on all available conversation context and inferred workflows discussed during previous sessions.
> Some details may represent observed behavior from testing environments rather than official documentation.

---

# 1. High-Level Understanding of Dawana

Dawana appears to be a pharmaceutical / healthcare supply-chain platform integrated with:

- Serialization systems
- GS1 standards
- Masar integration
- Pharmacy workflows
- Incident management
- Inventory tracking
- Dispensing / selling workflows
- SSCC handling
- SGTIN-level traceability
- Batch and stock management

The platform seems to support:

- Pharmacies
- Warehouse operations
- Serialized product tracking
- Drug dispensing
- Return workflows
- Incident reporting
- Product receiving
- Invoice operations
- Integration with external systems such as Masar

---

# 2. Core Business Domain

## Pharmaceutical Serialization

The platform heavily relies on:

- GTIN
- SGTIN
- SSCC
- Batch
- Expiry
- Serialized packs

### Important Concepts

## GTIN
Global Trade Item Number.
Represents product identity.

## SGTIN
Serialized GTIN.
Represents:

- GTIN
- Serial number

Used for identifying a single saleable pharmaceutical unit.

## SSCC
Serial Shipping Container Code.
Represents an entire logistics unit (carton / case / pallet).

A single invoice may contain:

- Multiple SSCCs
- Multiple cartons
- Multiple products

Receiving can happen by:

- Scanning individual SGTINs
- Receiving entire SSCCs

---

# 3. Masar Integration

Dawana is integrated with another system called Masar.

## Masar Responsibilities (Observed)

Masar appears responsible for:

- Serialization traceability
- Transaction visibility
- Product movement tracking
- SSCC hierarchy tracking
- Product state transitions
- Trace operations
- Transaction history

## Observed Cross-System Behavior

### Sell Using Agent Flow

Observed issue:

- Dawana displays:
  - "Dispense completed"
- But in Masar:
  - SSCC quantity decreases
  - Product disappears from SSCC
  - Trace shows no transaction

This indicates:

- Inventory mutation may occur without proper transaction persistence
- Or synchronization issue between Dawana and Masar
- Or transaction logging failure

---

# 4. Roles Mentioned

## Pharmacy Manager

Observed permissions/workflows:

- Create incidents
- Submit incident forms
- Scan products
- Confirm incident operations
- Interact with product lists

---

# 5. Incident Module

One of the most discussed modules.

## Purpose

Handles problematic pharmaceutical products such as:

- Damaged items
- Expired items
- Incorrect quantities
- Inventory discrepancies

---

# 6. Incident Workflow (Observed)

## General Flow

1. User opens incident module
2. Selects incident reason
   Example:
   - Damaged
3. Scans product / carton
4. System validates:
   - Quantity
   - Batch
   - Stock
   - Serialized units
5. User confirms incident
6. Backend processes inventory changes

---

# 7. Important Incident Validation Logic

## Stock Quantity Validation

Observed scenario:

- Product max quantity = 30
- User enters 31
- System allowed the operation path until failure stage

Expected validation:

- Quantity must not exceed available stock

Potential issue:

- Validation may occur too late
- Frontend may not block invalid values immediately

---

# 8. Frontend State Bug in Incident Module

Observed critical bug:

When:

- User enters invalid quantity
- Backend rejects request
- Operation fails

Frontend behavior:

- Product still added to product list

Problem:

- UI state becomes inconsistent with backend state
- Failed operation is visually treated as successful pending item

Consequence:

- Repeated confirm attempts continue failing
- User confusion
- Duplicate invalid items remain in UI

Expected behavior:

- Failed product must not persist in product list
- Or invalid item should be removed automatically
- Or row should be marked invalid and blocked

---

# 9. Receiving Logic

Observed receiving modes:

## Receiving by SGTIN

Receive individual serialized packs.

## Receiving by SSCC

Receive complete cartons/cases.

### Important Insight

Invoice may contain multiple SSCCs.

Meaning:

- Multiple cartons can belong to same invoice
- Hierarchical receiving is supported
- System likely supports aggregation/disaggregation

---

# 10. Invoice Structure Observed

Example structure included:

```json
{
  "branch_code": "",
  "pharmacy_code": "code-test4190",
  "bill_number": "invoice-stage-0111",
  "total_price": 100,
  "products": [
    {
      "product_name": "Spiriva 18mcg 30 powder inhalation hard capsules + 1 Handihaler Device"
    }
  ]
}
```

Possible fields inferred:

- branch_code
- pharmacy_code
- bill_number
- total_price
- products[]
- company_name
- batch
- expiry
- quantity
- serialized identifiers

---

# 11. Authentication API Insights

Observed auth endpoint behavior:

## Supported Grant Type

Only:

```text
password
```

is supported.

Error observed:

```json
{
  "message": "Unsupported grant_type. Only \"password\" is supported."
}
```

---

# 12. Common API Characteristics

Observed characteristics:

- REST APIs
- JSON payloads
- Correlation IDs
- Validation-based responses
- Error structures with:
  - statusCode
  - timestamp
  - path
  - method
  - correlationId
  - message
  - error

Example:

```json
{
  "statusCode": 400,
  "timestamp": "2026-05-11T19:08:07.342Z",
  "path": "/masar-service/api/v1/auth",
  "method": "POST",
  "correlationId": "no-context",
  "message": "Unsupported grant_type. Only \"password\" is supported.",
  "error": "Bad Request"
}
```

---

# 13. Automation & Testing Context

You are building extensive testing assets around Dawana.

## Areas You Focused On

### Manual Testing

- Test cases
- Bug reports
- Workflow validation
- Negative scenarios
- State validation
- UI/backend consistency

### API Testing

- Postman collections
- Dynamic variable generation
- GUID generation
- Timestamp-based transaction IDs
- Automated test scripts

### Automation Testing

You are learning:

- Selenium with Java
- API automation
- Framework architecture

Potential future Dawana automation targets:

- Incident flows
- Dispense workflows
- Inventory validation
- Authentication
- Serialized receiving
- Invoice operations

---

# 14. Important Edge Cases for Testing

## Inventory

- Quantity exceeds stock
- Duplicate serial scan
- Invalid SSCC
- Expired products
- Mixed batches
- Missing transaction logs
- Partial carton operations
- Carton/product mismatch

---

# 15. SSCC/Serialization Risks

Potential high-risk areas:

## Aggregation Integrity

When removing product from SSCC:

- Parent-child hierarchy must remain correct

## Traceability Integrity

Every inventory mutation should generate:

- Transaction log
- Trace entry
- Audit trail

## State Synchronization

Dawana UI state must match:

- Backend stock
- Masar trace state
- Serialized ownership

---

# 16. Important Testing Areas

## Incident Module

High-priority validations:

- Quantity validation
- Duplicate scans
- Product removal after failed API
- Error handling
- Loading state handling
- Retry logic
- Product list synchronization

---

# 17. Sell Using Agent Workflow

Observed modes:

- Strip mode
- Pack mode

Potential operations:

- Dispense serialized packs
- Update SSCC contents
- Deduct inventory
- Register trace transaction

Observed critical defect:

- Dispense success message shown
- Actual trace transaction missing

Possible root causes:

- UI success before backend confirmation
- Async transaction failure
- Event publishing failure
- Masar sync issue
- Missing rollback

---

# 18. Data Integrity Risks

## Critical Risks

### Ghost Inventory Changes

Inventory changes without trace logs.

### UI Desynchronization

Frontend showing products not actually processed.

### Serialization Corruption

SSCC hierarchy mismatch after operations.

### Partial Failures

One subsystem succeeds while another fails.

---

# 19. Suggested Testing Strategy

## Functional Testing

Validate:

- Business rules
- User permissions
- Workflow correctness
- Serialization rules

## Integration Testing

Validate:

- Dawana ↔ Masar sync
- Transaction persistence
- Trace consistency

## Negative Testing

Validate:

- Invalid quantities
- Duplicate scans
- Missing fields
- Invalid serials
- Unsupported operations

## State Validation Testing

Validate:

- UI state after failure
- Inventory rollback
- Transaction atomicity

---

# 20. Suggested Folder Structure for Your Testing Knowledge Base

```text
project/
│
├── requirements/
│   └── frs.md
│
├── prompts/
│
├── knowledge/
│   ├── serialization.md
│   ├── sscc.md
│   ├── masar-integration.md
│   ├── incidents.md
│   ├── workflows.md
│   ├── authentication.md
│   └── business-rules.md
│
├── features/
│   ├── incident/
│   │   ├── screenshots/
│   │   ├── testcases.md
│   │   ├── bugs.md
│   │   └── workflows.md
│   │
│   ├── receiving/
│   ├── selling/
│   ├── invoices/
│   └── inventory/
│
├── api/
│   ├── collections/
│   ├── environments/
│   └── scripts/
│
└── automation/
    ├── selenium/
    ├── api/
    └── framework/
```

---

# 21. Likely Important Business Rules

## Serialization Rules

- SGTIN must be unique
- SSCC may contain multiple serialized products
- Product ownership/state must be traceable

## Inventory Rules

- Quantity cannot exceed available stock
- Removed serialized item must update hierarchy
- Every stock mutation requires transaction logging

## Incident Rules

- Failed operations should not persist visually
- Invalid product should not remain selectable
- Incident quantities must be validated immediately

---

# 22. Potential Architecture Characteristics

Based on observed behavior, the platform may use:

- Microservices
- Event-driven communication
- API gateway
- Separate traceability service
- Async synchronization with Masar

Possible services:

- Auth service
- Inventory service
- Incident service
- Serialization service
- Traceability service
- Dispensing service
- Invoice service

---

# 23. Most Critical Bugs Observed So Far

## Bug 1 — Incident Invalid Quantity UI Persistence

Severity: High

Problem:

- Failed product remains in UI product list.

Impact:

- Repeated failures
- Incorrect UI state
- User confusion

---

## Bug 2 — Missing Trace Transaction After Successful Dispense

Severity: Critical

Problem:

- Product removed from SSCC
- Trace transaction missing

Impact:

- Broken pharmaceutical traceability
- Audit/compliance risk
- Inventory inconsistency

---

# 24. Important Terminology

| Term | Meaning |
|---|---|
| GTIN | Product identifier |
| SGTIN | Serialized product identifier |
| SSCC | Shipping container identifier |
| Trace | Transaction history of serialized products |
| Dispense | Selling/removing pharmaceutical units |
| Incident | Problematic inventory workflow |
| Batch | Production lot |
| Agent Selling | Assisted selling workflow |

---

# 25. What You Should Continue Building

## Knowledge Base

You should maintain:

- Business rules
- Validation rules
- Edge cases
- Workflow diagrams
- API contracts
- Bug patterns
- Integration assumptions

---

# 26. Recommended Future Documentation

## Per Module

Each feature should include:

- Overview
- Roles
- Preconditions
- Main flow
- Alternative flow
- Error flow
- API calls
- Validations
- Edge cases
- Test scenarios
- Known bugs

---

# 27. Recommended Test Coverage

## Must-Have Coverage

### UI

- Forms
- Validation
- State synchronization
- Loading/error states

### API

- Authentication
- Authorization
- Validation
- Serialization integrity
- Response consistency

### Integration

- Masar synchronization
- Trace generation
- Transaction persistence

### Database/State

- Inventory correctness
- SSCC hierarchy
- Product ownership
- Transaction atomicity

---

# 28. Biggest Technical Risk Areas

## Serialization Integrity

If serialization breaks:

- Regulatory issues may occur
- Traceability becomes unreliable

## Async Failure Handling

UI success without backend completion is extremely dangerous.

## Inventory Consistency

Inventory and trace logs must always remain synchronized.

---

# 29. Best Testing Mindset for Dawana

Always validate:

1. UI result
2. Backend response
3. Inventory state
4. SSCC state
5. Trace transaction
6. Masar synchronization
7. Rollback behavior after failure

Never trust only:

- Success toast
- Frontend state
- Partial response

Always verify downstream effects.

---

# 30. Final Understanding

Dawana is not just a pharmacy UI.

It is a serialized pharmaceutical supply-chain and traceability system where:

- Inventory integrity
- Serialization integrity
- Transaction traceability
- Regulatory correctness
- Cross-system synchronization

are all mission-critical.

The most dangerous defects are not UI bugs.

The most dangerous defects are:

- Silent data corruption
- Missing trace transactions
- Inventory desynchronization
- Serialization hierarchy corruption
- Partial transactional failures

