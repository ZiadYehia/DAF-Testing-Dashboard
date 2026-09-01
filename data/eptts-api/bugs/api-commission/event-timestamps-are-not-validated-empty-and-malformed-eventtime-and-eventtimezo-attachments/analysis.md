# Background for event-timestamps-are-not-validated-empty-and-malformed-eventtime-and-eventtimezo

Moved out of the bug body to keep the report to the point. Not an attachment the platform indexes (only images and video are), just a file kept beside it.

For a track-and-trace platform this is the most consequential of the validation gaps found: the entire evidentiary value of an EPCIS chain rests on a defensible event chronology. An event with no timestamp, or a timestamp in an ambiguous format, or an impossible timezone offset, cannot be placed reliably in sequence — which undermines the audit trail these events exist to produce.

Contrast with the fields that ARE validated well: `readPoint.id` and `bizLocation.id` are checked for presence and for canonical SGLN form, `schemaVersion` is pinned to "2.0", and lot numbers are allow-listed.

**Exchange evidence:** `1-exchange-tc_comm_025.jpg`, `2-exchange-tc_comm_026.jpg`, `3-exchange-tc_comm_027.jpg` — the exact request, the response, and the platform's verdict from `MsgStatusQuery`. Replayable copies (`api-log.html`, `api-postman-collection.json`) are written beside each run under `automation-hub/projects/<project>/runs/`. The same shape repeats for `TC_COMM_028`, `TC_DEST_019`, `TC_DEST_020`, `TS_RECV_029`, `TS_RECV_030`, `TS_RTN_032`, `TS_RTN_033`, `TS_RTRV_030`, `TS_RTRV_031`, `TC_SHIP_025`, `TC_SHIP_026`, `TC_SHIP_039`.

**Covers test cases:** `TC_COMM_025`, `TC_COMM_026`, `TC_COMM_027`, `TC_COMM_028`, `TC_DEST_019`, `TC_DEST_020`, `TS_RECV_029`, `TS_RECV_030`, `TS_RTN_032`, `TS_RTN_033`, `TS_RTRV_030`, `TS_RTRV_031`, `TC_SHIP_025`, `TC_SHIP_026`, `TC_SHIP_039`

Covered by `TC_COMM_025`–`TC_COMM_028` in `automation-hub/projects/eptts-api-commission/`, all marked `test.fail()`. The four almost certainly share one root cause: no validation on the event time fields.

---
**SCOPE CORRECTION (2026-09-01): this is not a Commissioning defect.**

A full clean run of all 351 API cases reproduced the same gap on five more features, so the
missing validation is in the shared EPCIS event validator, not the commissioning handler.
Fixing it only here would leave the rest:

| Feature | Cases |
|---|---|
| Commissioning | `TC_COMM_025`, `TC_COMM_026`, `TC_COMM_027`, `TC_COMM_028` |
| Destruction | `TC_DEST_019`, `TC_DEST_020` |
| Receiving | `TS_RECV_029`, `TS_RECV_030` |
| Return Shipping | `TS_RTN_032`, `TS_RTN_033` |
| Return Receiving | `TS_RTRV_030`, `TS_RTRV_031` |
| Shipping | `TC_SHIP_025`, `TC_SHIP_026`, `TC_SHIP_039` |

**The validator is NOT uniform, which is the useful part of this finding.** `/Dispensation`
*does* reject a malformed `eventTime` and a bad offset (`TC_DISP_022`, `TC_DISP_023`,
`TC_DISP_024`, and the partial-dispensing equivalents all pass). So a correct implementation
already exists in this codebase — the fix may be to apply the dispensing path's validation to
the `/scp/SendEPCIS` path rather than to write anything new.
