# Background for gln-filters-accept-a-malformed-gln-and-report-no-records-match-instead-of-invalid

Moved out of the bug body to keep the report to the point. Not an attachment the platform indexes (only images and video are), just a file kept beside it.

That answer is not merely unhelpful, it is wrong in a specific way: it tells the user their
filter is *valid but unmatched*, and directs them to widen the date range. No date range will
ever match, because the GLN cannot identify anything — it is not a GLN. The user is sent to
adjust the one input that is not the problem.

**The placeholders show the intent.** Two of the four say "13-digit GLN", so the field knows it
wants a GLN and not free text; it just never checks the one rule that distinguishes a GLN from
thirteen arbitrary digits. The check is four lines of arithmetic (GS1 mod-10) and needs no
backend call.

**Why it matters here rather than being cosmetic.** These are the audit screens — the ones
someone opens to answer "is our traceability record complete for this party?". A malformed GLN
returning "no records match" is indistinguishable from a correct GLN with genuinely no events.
An investigator can copy a GLN with one digit mistyped, see an empty audit log, and conclude a
party has no recorded activity when in fact they were never queried. That is a wrong conclusion
drawn from the audit trail, which is the one thing these screens exist to prevent.

This was checked for a message anywhere on the page, not just in the tab panel: there is **no
toast, no inline error, and no console-visible complaint**. The empty state is the entire
response.

**For contrast, the platform gets this right elsewhere.** The Add Manufacturer dialog's Verify
control answers a GLN it cannot check with a clear page-level toast — "GS1 verification is not
enabled in this environment". So the toast mechanism exists and is used for exactly this class
of problem; these four filters simply do not use it.

**Evidence:** `invalid-gln-returns-no-records-match.jpg` — the Integrity tab with
`8435308300003` in the "Chain status by GLN" box. The table reads "No records match these
filters … Widen the date range or clear a filter to see more", and no validation message
appears anywhere on the page. Note the summary above it: the log holds 48,074 records.

**Covers test cases:** `WEB_AIN_007`, `WEB_ARE_007`, `WEB_AES_005`, `WEB_AMD_005`

Covered by four automated cases, all of which assert that a validation message appears and
currently fail. The assertion looks for a complaint both inline and in a page-level toast —
scoping it to the tab panel alone would have missed the toast idiom this platform uses
elsewhere.

The equivalent cases on the four "Add …" forms (`WEB_SMF_007`, `WEB_SDP_007`, `WEB_SBP_007`,
`WEB_SPA_007`) are **not** part of this bug and are recorded as blocked, for two separate
reasons: on Manufacturer the GS1 verification path is switched off in this environment, and on
Dispenser there is no way to have a GLN checked without pressing Create, which would create a
record on production.
