# Patient Module — Domain Knowledge

## Role
Public access via the **Patient** button on the landing screen — **no login required**. Any member of the public can use this flow to verify a pharmaceutical product.

## Business Purpose
The Patient module enables consumers to verify the authenticity and supply-chain integrity of pharmaceutical packs they have been dispensed. By scanning or entering a GS1/SGTIN barcode, the patient can confirm the product is genuine and has passed through authorised supply channels.

## Features

| Feature | Description |
|---------|-------------|
| Validate Pack | Scan a pharmaceutical barcode to verify product legitimacy |

## Navigation
- **Entry point:** Landing screen → **Patient** button
- **No authentication:** bypasses Keycloak SSO entirely
- Back navigation returns to the landing screen

## Key UI Patterns
- Single-tile home screen (Validate Pack)
- Camera-based barcode scanner (GS1/SGTIN)
- Results shown inline after scan

## Locators
| Element | Strategy | Selector |
|---------|----------|----------|
| Validate Pack tile | accessibility id | `~Validate Pack` |

## Test Credentials
None — no login required.

## Business Rules
- No authentication needed
- Barcode must be a valid GS1/SGTIN format to return a result
- Unrecognised barcodes should return an appropriate error
- Network required for validation lookup

