# Analysis

## The trigger is the prior pharmacy return, not the hop

A branch CAN return a pack straight to the manufacturer when that pack never went to a pharmacy.
Probed directly on devsim with two packs commissioned and shipped together, then diverged:

| pack | history | branch -> manufacturer return |
|---|---|---|
| A | manufacturer -> branch, received | **S - Successful** |
| B | manufacturer -> branch -> pharmacy -> returned to branch | refused, naming the pharmacy |

So the second hop itself is sound. What breaks it is the pack having been returned by a pharmacy
first.

## The document is not the source of the refused GLN

Pulled from the run's own exchange log, all three return submissions in the journey:

    STEP 10  pharmacy -> branch   sender=pharmacy  source=pharmacy SGLN  dest=branch SGLN
    STEP 11  branch confirms      sender=branch    source=pharmacy SGLN  (no destination)
    STEP 12  branch -> mfg        sender=branch    source=branch SGLN    dest=mfg SGLN

`6220000000013` appears only in steps 10 and 11. Step 12 names the branch in every position that
could be read as a source: `sourceList[0].source`, `readPoint`, `bizLocation` and the SBDH sender.

## Two parts of the platform disagree about who holds the pack

`VerifyProduct` reports `currentGln` as the branch for both packs immediately before step 12 — the
suite asserts it, so the run fails on the return rather than on custody. The return handler
simultaneously believes the source is the pharmacy. Whatever record it reads, it is not the one
`VerifyProduct` serves.

## Why the test could not have caused it

Step 12 was rewritten to derive `sourceList`, `readPoint` and the SBDH sender from the custodian
`VerifyProduct` reports, rather than from the acting role. The derived document is byte-identical
to the hard-coded one and the refusal is unchanged, so the document is not the variable.

## Reproduction note

A return confirmation must quote an EXISTING pending `returnRequestNumber` in
`bizTransactionList`; a fresh reference is refused with `No PENDING return found with
returnRequestNumber=…`. A shortened reproduction that invents a reference at step 5 never moves
custody, and step 7 then fails on a custody violation instead — which looks like a different
defect.
