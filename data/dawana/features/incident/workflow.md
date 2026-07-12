# [Feature Name] Workflow

---

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Incident Form |
| **Feature ID** | OWN_FR_15 (new) , MGR_FR_29 |
| **Role(s)** | Owner, Manager |
| **Module / Navigation Path** | Login → Home → Incident → Add New |
| **Priority** | P2 |
| **App Version Under Test** | v5.2.9 |
| **Status** | Done |

---

## Business Purpose

Incident allows pharmacy owner or manager to report and return damaged, expired, stolen, or defective pharmaceutical items from stock for proper tracking and correction. The feature ensures accurate inventory management and compliance by integrating with Masar for traceability and official reporting. It helps maintain stock integrity by documenting and processing incident-based product returns efficiently.

---

## Screens

### incidents-list.jpg

Shows all submitted incident reports with their creation date (e.g., "Incident 13 May 2026") and a status badge (e.g., "Approved"). Each entry has a [View More...] button to see details. A + Filter button at the top right allows filtering the list. A + Add New button (visible in one image) lets the user start creating a new incident. This is the main entry point for the Incident Forms feature.

### incident-form.jpg

The main form for creating or editing an incident report. Appears after tapping + Add New from the Incidents List. The user can:

Select a Reason from a dropdown (Expired, Damaged, Stolen, Lost)

Search for a Product Name (type‑ahead dropdown from pharmacy stock)

View auto‑filled, read‑only Generic Name and Dosage based on the selected product

Enter Quantity (numeric)

Click + Add Product to add another product row to the same incident

Click Submit to save the incident report

If a product comes from Masar Integration, scanning its barcode is mandatory. The system then shows the Enter Barcode Manually dialog or the Barcode Scanner screen.

### incident-upload-document.jpg

Image → opens a choice between Camera (take a photo) or Gallery (select existing image) – max 15 MB

File → opens file picker for documents (PDF, etc.) – max 5 MB

### incident-reasons-dropdown.jpg

A dropdown list that appears when the user taps the Reason field on the Incident Form. It contains four options (in Arabic):

انتهاء الصلاحية (Expired)

تالف (Damaged)

السرقة (Stolen)

فقدان (Lost)

Selecting one sets the reason for the incident.

### incident-manual-barcode-scan.jpg

A full‑screen scanner overlay that opens when a product from Masar Integration is selected and the user needs to scan its barcode. It provides:

A Manual Input tab where the user can paste raw barcode data

A Barcode Data text field

Cancel and Submit buttons

A custom on‑screen keyboard with alphanumeric and special characters (including Arabic letters)

After submitting the barcode, the system validates it and fills the product details automatically.

### incident-sgtin-input.jpg

A modal dialog that appears when the user chooses to manually enter barcode information instead of scanning. It contains:

GTIN field (Global Trade Item Number)

Serial Number field

Cancel and Submit buttons

This is an alternative to the camera scanner for cases where the barcode cannot be physically scanned.

---

## User Flow

1. Owner or Manager is on Home screen after logging into the pharmacy app.
2. User taps Incident tab.
3. Incident List screen opens showing previously submitted incidents with statuses (Pending/Approved/Rejected) and a + Add New button.
4. User taps + Add New to create a new incident.
5. Incident Form (Add More Products) opens with fields: Reason, Product Name, Generic Name (read‑only), Dosage (read‑only), Quantity, Upload Document, + Add Product, and Submit.
6. User selects a Reason from the dropdown (Expired, Damaged, Stolen, or Lost).
7. User searches for a Product Name by typing – the system shows a dropdown of products currently in pharmacy stock.
8. If the selected product comes from Masar Integration:
- Barcode scanning becomes mandatory.
- User scans the barcode using the camera or enters it manually (GTIN + Serial Number).
- System validates the barcode and displays the correct batch/expiry.
9. If the product has multiple expiry dates or batch numbers:
- User selects the appropriate expiry date and batch (batch appears only if multiple exist for that expiry).
10. System auto‑fills Generic Name and Dosage (read‑only) based on the selected product.
11. User enters Quantity:
- For scanned (Masar) products, the maximum allowed quantity equals the available stock of that specific batch/item.
- For non‑scanned products, user can enter any positive whole number (subject to stock validation later).
12. User uploads a supporting document (optional but recommended):
- Image option → user can choose Camera (take a photo) or Gallery (select existing image) – max 15 MB.
- File option → user can select a document (PDF, etc.) – max 5 MB.
13. User repeats steps 6–12 for additional products by tapping + Add Product as needed.
14. User taps Submit to finalise the incident report.
15. System creates the incident with a Pending status and adds it to the Incident List (visible to the user).
16. The incident is sent to the inspector assigned to this pharmacy for review.
17. Inspector reviews and either Accepts or Rejects the incident:
- If Accepted: The reported items are permanently removed from pharmacy stock. The incident status updates to Approved, and the removal is reflected on the Masar dashboard with the new status (e.g., “Returned/Damaged”).
- If Rejected: The incident status changes to Rejected, and stock remains unchanged. The user may see a rejection reason if provided.
18. Ending state: The incident is finalised (Approved or Rejected), and stock is updated accordingly if approved.

---

## Field Definitions

| Field Name | Input Type | Required | Validation Rules / Notes |
| :--- | :--- | :--- | :--- |
| Reason | dropdown | Yes | Options: Damaged (تالف) / Expired (انتهاء الصلاحية) / Stolen (السرقة) / Lost (فقدان) |
| Product Name | search/lookup | Yes | Must exist in pharmacy stock. If product is from **Masar Integration**, barcode scan becomes mandatory. |
| Generic Name | text (auto-fill) | No | Auto-populated after product selection, read‑only |
| Dosage | text (auto-fill) | No | Auto-populated after product selection, read‑only |
| Expiry Date | dropdown (conditional) | Yes | *Required only if the selected product has multiple expiry dates. Shows all valid expiries for that product. |
| Batch Number | dropdown (conditional) | Yes | *Required only if the selected expiry date has multiple batch numbers. Appears only when applicable. |
| Quantity | number | Yes | Must be > 0 and ≤ available stock. For scanned (Masar) products, max = available stock of the scanned batch. |
| SGTIN / Barcode | barcode scan or manual | Conditional | **Mandatory** for products that came from Masar Integration. Manual entry includes GTIN + Serial Number fields. Not required for non‑Masar products. |
| Supporting Document | file upload | No | Two options: **Image** (Camera or Gallery, max 15 MB) or **File** (e.g., PDF, max 5 MB). |

---

## Business Rules

- Owner & Manager role can submit an incident report.
- Reason is mandatory and must be selected from the predefined list: Damaged (تالف), Expired (انتهاء الصلاحية), Stolen (السرقة), or Lost (فقدان).
- Product must exist in the pharmacy's current stock to be selectable.
- If the selected product originated from Masar Integration, barcode (SGTIN) scanning is mandatory — either via camera or manual GTIN + Serial Number entry.
- For products not from Masar Integration, the user can manually search and select the product from the dropdown without scanning.
- If a product has multiple expiry dates, the user must select one from the dropdown.
- If the selected expiry date has multiple batch numbers, the user must select the relevant batch.
- Generic Name and Dosage are auto‑filled from the database after product selection and are read‑only.
- Quantity must be a positive whole number (>0).
- For scanned (Masar) products, the quantity cannot exceed the available stock of that specific batch.
- For non‑scanned products, quantity is subject to stock validation at submission (cannot exceed total stock of the selected batch).
- Supporting document upload is optional. Image upload (Camera or Gallery) has a maximum size of 15 MB. File upload (PDF, etc.) has a maximum size of 5 MB.
- The user can add multiple products to the same incident using the **+ Add Product** button before submission.
- After submission, the incident is saved with a **Pending** status and appears in the Incident List.
- The incident is sent to the inspector assigned to that pharmacy for review.
- If the inspector **accepts** the incident:
  - The reported items are permanently removed from pharmacy stock.
  - The incident status updates to **Approved**.
  - The removed items are reflected on the Masar dashboard with the new status (e.g., “Returned” / “Damaged”).
- If the inspector **rejects** the incident:
  - The incident status changes to **Rejected**.
  - Stock remains unchanged.
  - A rejection reason may be provided to the user.

---

## Dropdown Options

**Reason:**
- تالف (Damaged)
- انتهاء الصلاحية (Expired)
- السرقة (Stolen)
- فقدان (Lost)

**Expiry Date (conditional):**
- Dynamically populated based on selected product (only shown if product has multiple expiry dates)

**Batch Number (conditional):**
- Dynamically populated based on selected expiry date (only shown if multiple batch numbers exist for that expiry)

---

## Edge Cases / Known Behaviors

- If a product has no valid stock (all batches expired or quantity zero), it should not appear in the Product Name search results.
- For products from Masar Integration, barcode scan is mandatory; the user cannot submit without scanning unless the product is not Masar-tracked.
- Manual barcode entry is available as a fallback (GTIN + Serial Number) when camera scan fails.
- If the scanned barcode does not match any product in the pharmacy's stock, an error message is shown and the product is not added.
- Quantity maximum for scanned items = available stock of that specific batch. For non‑scanned items, quantity is limited by total stock of the selected batch.
- Adding multiple products to the same incident: each product line has its own reason, expiry, batch, quantity, and (if Masar) its own barcode.
- After submission, the incident appears in the list with **Pending** status. The user cannot edit a submitted incident unless the inspector rejects it (TBD if edit is allowed).
- If the inspector rejects the incident, the user can view the rejection reason and may be allowed to resubmit with corrections.
- When the inspector accepts the incident, the stock reduction is permanent and synchronized with Masar dashboard.

---

## Open Questions / TBD

- [yes] Can the same product (same batch) be reported in multiple incidents before the first one is approved/rejected?
- [no] Is document upload mandatory for certain reason types (e.g., Stolen requires police report)? Currently it's optional in UI.
- [should be rejected] What happens if a Masar product's barcode is scanned but the quantity entered exceeds the available stock? Is there a frontend limit or a backend validation?
- [yes] Can the user delete a product line from the **+ Add Product** list before submission?
- [no] Is there a time limit for the inspector to review an incident before it auto‑expires?

---

## Related Features

| Feature ID | Feature Name | Relationship |
|------------|--------------|--------------|
| MGR_FR_22 | First-Time Setup (Adding Quantities) | Stock must be initialized before products can be reported in incidents. |
| MGR_FR_31 | New Stock Request | Only approved stock appears as available for incident reporting. |
| INS_FR_70 | Incident Investigation | Inspector reviews and approves/rejects incidents submitted by pharmacy users. |
| OWN_FR_14 / MGR_FR_24 / PHR_FR_42 | Dispense flows | Incidents remove stock from inventory, affecting future dispense availability. |
