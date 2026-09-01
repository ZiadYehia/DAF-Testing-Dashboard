# Background for an-empty-epclist-is-accepted-and-an-empty-string-epc-is-misclassified-as-an-sscc

Moved out of the bug body to keep the report to the point. Not an attachment the platform indexes (only images and video are), just a file kept beside it.

**TC_COMM_004 — `epcList: []`.** A commissioning event carrying zero EPCs is accepted and reports *"Message processed successfully — all 1 event(s) completed"*. Tellingly the log omits the *"Commission (Items) event processed successfully"* line it emits for real work, so the platform knows it commissioned nothing yet still reports success.

**TC_COMM_004b — `epcList: [""]`.** An empty-string EPC is accepted **and misclassified**: the log reads *"Commission (**SSCCs**) event processed successfully"*. An empty string is being parsed as an SSCC rather than rejected as an invalid EPC. That is an EPC-parsing bug, not merely a missing length check, and it means a malformed EPC can be routed down the wrong processing path.

Note the same empty-eventList behaviour also exists one level up: a well-formed envelope whose `epcisBody.eventList` is `[]` is likewise accepted with 202 / I001.

**Exchange evidence:** `1-exchange-tc_comm_004.jpg`, `2-exchange-tc_sec_029.jpg` — the exact request, the response, and the platform's verdict from `MsgStatusQuery`. Replayable copies (`api-log.html`, `api-postman-collection.json`) are written beside each run under `automation-hub/projects/<project>/runs/`.

**Covers test cases:** `TC_COMM_004` `TC_SEC_029`

Covered by `TC_COMM_004` / `TC_COMM_004b` (both `test.fail()`), by `SMOKE-05b` in `automation-hub/projects/eptts-api-smoke/`, and by `TC_SEC_029` in the `api-security` feature — which re-tests the empty-`eventList` case through the security lens (input validation: a document with zero events is accepted with `202` / `I001` instead of being rejected). The SSCC misclassification is the part worth investigating first — it points at the EPC parser rather than at input validation.

---
**SCOPE CORRECTION (2026-09-01): empty-list acceptance is platform-wide, not just `epcList`.**

A full clean run showed the same behaviour for `sourceList`, `destinationList` and
`bizTransactionList` across shipping, receiving and both return legs — 8 cases in total. Filed
as *"Empty required lists are accepted across shipping, receiving and both return legs"*
(`api-shipping`), which lists them.

Keep this ticket for the commissioning `epcList` case and its separate finding that an
empty-string EPC is misclassified as an SSCC — that part is specific to the identifier parser
and does not appear in the wider set.
