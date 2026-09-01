# Background for shipping-page-shows-the-raw-i18n-key-shipments-bulkupload-instead-of-a-button-label

Moved out of the bug body to keep the report to the point. Not an attachment the platform indexes (only images and video are), just a file kept beside it.

**It is missing from BOTH locales.** The dashboard defaults to Arabic and has an EN/AR toggle;
the key appears unresolved in Arabic *and* in English. That rules out the common case of one
locale lagging behind the other, and points at the key never having been added to either
catalogue — most likely a button shipped after its strings.

Why it matters more than a cosmetic label: this is the entry point to bulk shipping upload on a
P1 custody-transfer page. A user cannot tell what the button does, and "bulkUpload" is a
destructive-adjacent action (it submits shipping events for many packs at once). An operator
guessing at an unlabelled control on the shipping screen is a real risk, not a polish issue.

Found during a systematic sidebar discovery pass, not while testing this page specifically —
so it is worth checking whether other recently-added controls have the same gap.

**Evidence:** `data/eptts-web/features/web-shipping/screenshots/web-shipping.jpg` — captured
with the UI in English, showing the unresolved key in the button row.

**Covers test case:** `WEB_SHP_001`
