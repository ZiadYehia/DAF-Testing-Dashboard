# Background for identical-packing-and-unpacking-requests-are-accepted-twice-with-no-idempotency

Moved out of the bug body to keep the report to the point. Not an attachment the platform indexes (only images and video are), just a file kept beside it.

The second submission is *not* an exact byte-for-byte replay: each carries a fresh
`instanceIdentifier`, since the platform rejects a reused one. So the message-level replay
guard works; what is missing is the **event-level** check that the requested state change has
already been made. Packing packs that are already in that container, or unpacking packs that
are already out of it, are both no-ops being reported as successful work.

Why it matters, and why it is P2 rather than P1: it does not by itself corrupt the current
state — the pack ends up where it would have anyway. The damage is to the event history, which
is the actual product here. A duplicate aggregation event makes it look as though the container
was built twice, and any count or reconciliation derived by replaying events (rather than
reading current state) will double-count. In a system whose purpose is an auditable chain of
custody, a trace containing events that never physically happened is a real defect.

It is also the shape of a retry bug in a partner integration: a client that resends after a
timeout has no way to discover its first attempt succeeded, and the platform will happily
record the work twice.

Related, already filed for commissioning: *"An already-commissioned SGTIN can be
re-commissioned, and re-commissioning with a different expiry is accepted"* (`TC_COMM_003`,
`TC_COMM_012`). That is the same missing already-in-this-state check on a third feature, which
suggests the guard is absent generally rather than in the aggregation handler specifically.

**Evidence:** `api-log.html` for `eptts-api-packing-ts_pack_016` and
`eptts-api-unpacking-ts_unpk_011` — each shows both submissions and both successful polls.

**Exchange evidence:** `1-exchange-ts_pack_016.jpg`, `2-exchange-ts_unpk_011.jpg` — the exact request, the response, and the platform's verdict from `MsgStatusQuery`. Replayable copies (`api-log.html`, `api-postman-collection.json`) are written beside each run under `automation-hub/projects/<project>/runs/`.

**Covers test cases:** `TS_PACK_016`, `TS_UNPK_011`
