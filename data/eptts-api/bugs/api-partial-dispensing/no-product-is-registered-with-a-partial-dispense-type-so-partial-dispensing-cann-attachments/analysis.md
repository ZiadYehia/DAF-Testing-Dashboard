# Background for no-product-is-registered-with-a-partial-dispense-type-so-partial-dispensing-cann

Moved out of the bug body to keep the report to the point. Not an attachment the platform indexes (only images and video are), just a file kept beside it.

**None is held by GLN 8435308300002**, the manufacturer whose API key this suite
authenticates with — and the platform correctly refuses to let one MAH act for another's
product. Commissioning `06290009990011` (the most promising candidate: partial, non-Dawana,
active) is rejected with:

**That refusal is correct behaviour, not a defect.** A manufacturer minting serial numbers
against another company's GTIN is precisely what MAH ownership exists to prevent. The message
is exemplary: it names both GLNs, the rule, and the remedy.

So the chain cannot even begin. Partial dispensing needs a commissioned pack of a partial
product; we cannot commission one; therefore the **13 remaining partial-dispensing cases**
cannot be exercised. (The envelope and field negatives in this feature do not depend on
`dispenseType` and already run.)

A second constraint would bite even if ownership were solved for the wrong candidate: 2 of the
5 partial products — including LoadTest Product 0 — are `isDawanaIntegration: true`, and this
channel refuses those outright: *"Dispensing is not allowed for Dawana-integrated products via
this channel. These products must be dispensed through the Dawana integration."* Any fix
should therefore target one of the **non-Dawana** partial products.

**Exchange evidence:** `1-exchange-commission-ownership-refusal.jpg` — the commissioning attempt and the platform’s ownership refusal, which is what blocks the 13 cases.

**Covers test cases:** `TC_PDISP_001`, `TC_PDISP_002`, `TC_PDISP_003`, `TC_PDISP_004`, `TC_PDISP_010`, `TC_PDISP_011`, `TC_PDISP_013`, `TC_PDISP_017`, `TC_PDISP_018`, `TC_PDISP_019`, `TC_PDISP_020`, `TC_PDISP_021`, `TC_PDISP_022`

This is a test-data / environment gap, not a code defect — no part of it should be fixed in
application code. Any one of these unblocks it:

1. Add `8435308300002` as the `registeredAgentGln` on `06290009990011` or `05413868123456`
   (both partial and non-Dawana). This is the remedy the platform's own error message
   proposes, and it is the smallest change.
2. Register a new partial, non-Dawana product under MAH `8435308300002`.
3. Supply the API key of a MAH that already holds a non-Dawana partial product
   (`6290009990004` or `5413868000009`).

Until then the 13 dependent cases stay `blocked` with this reason recorded, rather than being
reported as untested or quietly passing.
