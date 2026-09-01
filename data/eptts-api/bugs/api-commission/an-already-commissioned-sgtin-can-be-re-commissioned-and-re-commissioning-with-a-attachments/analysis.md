# Background for an-already-commissioned-sgtin-can-be-re-commissioned-and-re-commissioning-with-a

Moved out of the bug body to keep the report to the point. Not an attachment the platform indexes (only images and video are), just a file kept beside it.

Submitting the same commissioning event twice for the same SGTIN returns `202` and then `messagestatus: "S - Successful"` with *"Commission (Items) event processed successfully"* both times (**TC_COMM_003**).

Worse, re-commissioning the same SGTIN with a **different expiry date** also succeeds (**TC_COMM_012**), which means a caller can silently rewrite an existing pack's master data after the fact. The same is true of a **different batch** (**TC_COMM_011**): with a lot number inside the platform's 20-character limit, the platform answers `S - Successful`. **No ilmd change is checked at all** — there is no partial guard, so a fix must cover plain duplicates, batch and expiry together.

The source test suite recorded TC_COMM_003 as a *Positive* case expecting the pack to "stay Commissioned". A reviewer had already flagged that as wrong in the spreadsheet — *"How is that positive? system should reject an already commissioned pack"* — and that reviewer is correct.

**Exchange evidence:** `1-exchange-tc_comm_003.jpg`, `2-exchange-tc_comm_011.jpg`, `3-exchange-tc_comm_012.jpg` — the exact request, the response, and the platform's verdict from `MsgStatusQuery`. Replayable copies (`api-log.html`, `api-postman-collection.json`) are written beside each run under `automation-hub/projects/<project>/runs/`.

**Covers test cases:** `TC_COMM_003`, `TC_COMM_011`, `TC_COMM_012`

Covered by automated tests `TC_COMM_003`, `TC_COMM_011` (different batch) and `TC_COMM_012` (different expiry) in `automation-hub/projects/eptts-api-commission/`. All are marked `test.fail()` so the suite stays green while the gap exists and reports an "unexpected pass" the moment it is fixed.
