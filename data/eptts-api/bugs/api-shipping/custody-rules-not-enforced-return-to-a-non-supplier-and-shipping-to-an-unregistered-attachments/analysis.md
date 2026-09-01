# Background for custody-rules-not-enforced-return-to-a-non-supplier-and-shipping-to-an-unregistered

Moved out of the bug body to keep the report to the point. Not an attachment the platform indexes (only images and video are), just a file kept beside it.

**`TC_SHIP_036` — shipping to an unregistered destination.** A shipping event naming a GLN
that is not a registered trade party is accepted and committed. The supply chain's whole
premise is that stock only ever moves between known, licensed parties; an unregistered
destination means the platform has recorded product leaving the traceable chain to somewhere
it cannot describe. It also cannot be undone by the receiver, because there is no receiver.

**`TS_RTN_012` — returning to a party that never supplied the pack.** A return is accepted to
an arbitrary registered GLN rather than the partner the stock actually came from. A return is
the one movement whose destination is *determined* by history rather than chosen, so this is
not a missing input check — the platform holds the supplying party and does not consult it.

Taken together these are the same failure: **the destination of a custody transfer is written
to the trace without being validated against who is allowed to receive it.** Unlike the
malformed-input defects filed alongside this one, these documents are entirely well-formed —
no validator on syntax would catch them. They need the business rule.

The practical consequence is that the trace can show stock in the hands of a party that
never received it, or that does not exist. Anything built on custody — recall reach,
inventory reconciliation, regulatory reporting — is then wrong in a way that reads as
authoritative.

Worth checking as part of a fix whether the receiving side has the mirror gap: if an
unregistered or unrelated GLN can also *accept* stock, the chain can be closed in both
directions without either party being entitled to the goods.

**Evidence:** `api-log.html` for `eptts-api-shipping-tc_ship_036` and
`eptts-api-return-ts_rtn_012` — both show the full request and the successful poll result.

**Exchange evidence:** `1-exchange-tc_ship_036.jpg`, `2-exchange-ts_rtn_012.jpg` — the exact request, the response, and the platform's verdict from `MsgStatusQuery`. Replayable copies (`api-log.html`, `api-postman-collection.json`) are written beside each run under `automation-hub/projects/<project>/runs/`.

**Covers test cases:** `TC_SHIP_036`, `TS_RTN_012`
