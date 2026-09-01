# Background for a-product-is-stored-with-a-non-numeric-gtin-one-record-has-its-gtin-and-name-tra

Moved out of the bug body to keep the report to the point. Not an attachment the platform indexes (only images and video are), just a file kept beside it.

```json
{ "gtin": "Temodal 100 mg",
  "name": "00366582511120",
  "manufacturer": "Orion Corporation, Tengstrominkatu 8 Turku, FI-20360, Finland",
  "mahGln": "6432109999994" }
```

Exactly 1 of the 100 products visible to admin is affected. The wider issue is that the platform accepted it at all: **a GTIN must be 14 numeric digits**, and the field is holding free text. GTIN is the key every SGTIN is derived from, so a non-numeric GTIN cannot be serialised, cannot be commissioned, and will fail EPC parsing for any partner that pulls this catalogue via the master-data snapshot.

Two distinct things to fix: correct the affected row's data, and add validation so the GTIN field cannot accept non-numeric text.

Note the Registry Products **page** displays this row in the correct orientation (GTIN column shows 00366582511120, NAME shows Temodal 100 mg), so the defect is only observable through the API. Worth checking whether the page reads a different endpoint or mirror. The attached screenshot is the Registry Products page for context.
