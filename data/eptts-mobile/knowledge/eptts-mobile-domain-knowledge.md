# EPTTS Mobile — Domain Knowledge

> This document is based on live app inspection via Appium MCP on a Samsung Galaxy Note 10+ (Android 12).

---

## 1. System Overview

EPTTS Mobile is the mobile application for the **Egyptian Pharmaceutical Track & Trace System**, operated by the **Egyptian Drug Authority (EDA)** (هيئة الدواء المصرية).

It runs on **Android and iOS** and enables multiple stakeholder roles to perform serialized pharmaceutical operations including receiving, selling, returning, and tracking pharmaceutical products.

---

## 2. Platform & Technology

| Attribute | Value |
|-----------|-------|
| Platform  | Android & iOS |
| Type      | Mobile app |
| App Package | `com.daf.eda.eptts` |
| Main Activity | `.MainActivity` |
| Authority | Egyptian Drug Authority (EDA) |
| Standards | GS1 / SGTIN / GTIN / GLN |

---

## 3. Landing Screen

The app opens to a branded screen showing the EDA logo with two entry points:

| Button | Style | Purpose |
|--------|-------|---------|
| **Sign In** | Filled (primary) | Role-based login for staff accounts |
| **Patient** | Outline (secondary) | Public access path for patients |

---

## 4. Roles

The **Sign In** flow supports multiple account types. The role is determined by the login credentials — the UI and available features change per role:

| Role | Description |
|------|-------------|
| **Pharmacy** | Pharmacy staff — can receive, sell, return pharmaceutical packs |
| **Branch** | Branch-level account |
| **Distributor** | Distributor account — handles supply-chain movements |
| **Inspector** | Inspector/auditor account — read-only or supervisory capabilities |
| **Patient** | Public access via the Patient button (separate flow) |

---

## 5. Core Features / Modules

*(To be expanded as each role's UI is explored.)*

- Receiving serialized products
- Selling / dispensing products
- Returning products
- Scanning GS1 barcodes / DataMatrix codes
- Transaction synchronization with EDA backend

---

## 6. Integration Points

- Backend: EDA Track & Trace system
- Authentication: Account-based login (role determined server-side)
- Standards: GS1 serialization (SGTIN, GTIN, GLN)

