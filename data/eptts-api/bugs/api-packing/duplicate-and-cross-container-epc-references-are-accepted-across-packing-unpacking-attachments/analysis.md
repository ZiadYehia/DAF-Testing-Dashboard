# Background for duplicate-and-cross-container-epc-references-are-accepted-across-packing-unpacking

Moved out of the bug body to keep the report to the point. Not an attachment the platform indexes (only images and video are), just a file kept beside it.

Confirmed on 6 cases across 5 features in a single clean run:

**`TS_PACK_011` is the most serious of the six** and deserves separate attention even if the
rest are fixed together. A pack physically exists in exactly one container. Accepting a
document that puts one child under two parents produces a hierarchy that cannot correspond to
reality, and the platform has no way to know afterwards which parent is the lie. Everything
computed from aggregation — what shipped, what a container holds, what a recall must reach —
inherits that corruption silently.

`TS_UNPK_005` is the same class from the other direction: unpacking a child from a container
it was never in should be refused on the pack's own recorded `parentSscc`, which the platform
already tracks and exposes through `VerifyProduct`.

Duplicates matter beyond tidiness: counts derived from `epcList` length (items in a shipment,
packs destroyed) become wrong, and a destruction event that names a pack twice is ambiguous
about whether one or two units left the supply chain.

Like the empty-list defect, the spread across five unrelated features points at the shared
EPCIS event validator rather than any single handler.

**Evidence:** the `api-log.html` artifact for each case records the submitted document and the
poll responses. Replay `eptts-api-packing-ts_pack_011` for the two-parent case.

**Exchange evidence:** `1-exchange-ts_pack_009.jpg`, `2-exchange-ts_pack_011.jpg`, `3-exchange-ts_unpk_005.jpg` — the exact request, the response, and the platform's verdict from `MsgStatusQuery`. Replayable copies (`api-log.html`, `api-postman-collection.json`) are written beside each run under `automation-hub/projects/<project>/runs/`. The same shape repeats for `TC_DEST_008`, `TS_RECV_015`, `TS_RTN_021`.

**Covers test cases:** `TS_PACK_009`, `TS_PACK_011`, `TS_UNPK_005`, `TC_DEST_008`, `TS_RECV_015`, `TS_RTN_021`
