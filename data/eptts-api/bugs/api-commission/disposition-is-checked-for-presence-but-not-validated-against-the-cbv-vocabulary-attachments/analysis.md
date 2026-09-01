# Background for disposition-is-checked-for-presence-but-not-validated-against-the-cbv-vocabulary

Moved out of the bug body to keep the report to the point. Not an attachment the platform indexes (only images and video are), just a file kept beside it.

A commissioning event with `disposition: "teleported"` is accepted and processed to *"S - Successful"* (**TC_COMM_034**). Any arbitrary string passes.

The same gap should be checked for `bizStep`, which is also a CBV-controlled field.

**Exchange evidence:** `1-exchange-tc_comm_034.jpg`, `2-exchange-ts_recv_028.jpg`, `3-exchange-ts_rtrv_029.jpg` — the exact request, the response, and the platform's verdict from `MsgStatusQuery`. Replayable copies (`api-log.html`, `api-postman-collection.json`) are written beside each run under `automation-hub/projects/<project>/runs/`.

**Covers test cases:** `TC_COMM_034`, `TS_RECV_028`, `TS_RTRV_029`

Covered by `TC_COMM_034` (marked `test.fail()`). `TC_COMM_033` (empty disposition) passes and is unaffected. Was recorded as `Fail` in the source spreadsheet and remains broken, unlike TC_COMM_033/035/038/041/042 which now reject correctly.

---
**SCOPE CORRECTION (2026-09-01): also present on Receiving and Return Receiving.**

The same unvalidated `disposition` was accepted on `TS_RECV_028` and `TS_RTRV_029` in a full
clean run, so this belongs to the shared event validator rather than the commissioning
handler. `TC_COMM_034` remains the commissioning instance.
