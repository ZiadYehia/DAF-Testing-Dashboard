# Inspector — Trace Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Trace (Inspector) |
| **Slug** | `inspector-trace` |
| **Module** | Inspector |
| **Navigation Path** | Inspector Home → Trace |
| **Priority** | P1 |

## Business Purpose

Allows the Inspector to trace the full supply-chain history of a pharmaceutical product by scanning or entering its GS1 barcode (SGTIN for individual packs, SSCC for containers/cases). Results show every custody transfer event across the supply chain.

## UI Elements (Verified 2026-07-09)

### Pack Tab (default)
| Element | Content-Desc / Hint | Clickable | Notes |
|---------|---------------------|-----------|-------|
| Page title | `Trace` | false | heading |
| Back button | `Back` | true | `android.widget.Button` |
| Pack tab | `Pack` | varies | active tab styled differently |
| Container tab | `Container` | varies | |
| Entity filter | `All entities` | true | optional entity dropdown |
| Entity label | `Entity (optional)` | false | label |
| Scan circle | *(no content-desc)* | true | clickable `android.view.View`; no identifier |
| Scan label | `Scan pack barcode` | false | label below scan circle |
| Divider | `OR` | false | separator |
| SGTIN input | hint=`Enter SGTIN (GTIN + Serial)` | true | `android.widget.EditText`; no resource-id |
| Trace button | `Trace` | true | primary action button |

### Container Tab
| Element | Content-Desc / Hint | Notes |
|---------|---------------------|-------|
| SSCC input | hint=`Enter SSCC` | `android.widget.EditText` |
| Scan circle | *(no content-desc)* | Same pattern as Pack tab |

**XPath for inputs:**
- Pack: `//android.widget.EditText[@hint="Enter SGTIN (GTIN + Serial)"]`
- Container: `//android.widget.EditText[@hint="Enter SSCC"]`

## Happy Path

### Pack Trace
1. From Inspector Home, tap **Trace**.
2. Trace screen opens with **Pack** tab active by default.
3. Tap the scan icon or type an SGTIN barcode in the input field.
4. Tap **Trace** (or the submit button).
5. Results list appears showing all supply-chain events for the pack (commissioning, shipping, receiving, dispensing).
6. Each event shows: event type, date/time, sender, receiver.

### Container Trace
1. Tap the **Container** tab.
2. Enter or scan an SSCC code.
3. Tap **Trace**.
4. Results show all events for that container/case.

## Edge Cases & Validation Rules

- Invalid SGTIN / SSCC: display an error message ("Barcode not found" or similar).
- Empty input: Trace button should be disabled or show a validation message.
- No events found for a valid barcode: display an empty-state message.
- Network error: show a retry option.

## Notes

- The two-tab design separates individual pack tracing (SGTIN/GTIN level) from container/case tracing (SSCC level).
- This is a read-only investigative tool — no data modification.
