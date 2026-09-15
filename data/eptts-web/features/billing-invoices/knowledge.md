# billing-invoices — Feature Knowledge

## Why this feature matters

Financial records. Arithmetic correctness and immutability after payment are the whole feature — a recalculated paid invoice is a far more serious defect than a rendering fault.

## What will bite you

- Columns: INVOICE #, MAH GLN, PIECES, BILLING CHARGE, ESERVICE, TOTAL, STATUS, CREATED, PAID.
- Verify `subtotal + fees = total` independently rather than trusting the displayed total, and that
  `sgtinCount` matches the pieces billed.
- Confirm a `PAID` invoice cannot be edited or re-totalled.

## What every case here has to account for

- **The Citrix VPN is a hard precondition.** Nothing on `192.168.225.195` resolves without it, and a
  dropped VPN looks exactly like a hung server: every request fails after a uniform ~10 s connect
  timeout. Rule that out before diagnosing anything.
- **TLS is a self-signed certificate.** Playwright needs `ignoreHTTPSErrors: true` (including in
  `browser.newContext()`, which does *not* inherit it from the config's `use` block), the Playwright
  MCP server needs `--ignore-https-errors`, curl needs `-k`, and Postman needs SSL verification off.
- **Two unrelated auth systems.** The dashboard is Keycloak OIDC (realm `masar`, client
  `masar-dashboard`, Authorization Code + PKCE); the B2B API is an `apikey` exchanged for a
  15-minute bearer token. A change to one cannot affect the other. Keycloak's direct password grant
  is **disabled**, so dashboard automation must drive the real browser login.
- **Secrets never go in `data/`.** It is committed. Reference the env key name
  (`EPTTS_MFG_APIKEY`), never the value.

## Case history and provenance

Per-case history for this feature: where each case came from, what the source
spreadsheet recorded, and what this project actually verified. Kept here rather than in
the test-case table, which holds only the 13 columns.

### Verification status

**Not yet executed against production.** Every case is `Under Testing` / `new_added`.

The source spreadsheet recorded these statuses against **staging**, by a different tester: Under Testing 8. Those are retained here as history only — they are not evidence of coverage in this environment, so they are deliberately not carried into the Status column.

### BIL_INV_009 - BIL_INV_011, added 2026-09-08

Written from live discovery against devsim, driven **as the manufacturer**. That matters for
this feature specifically, because the Invoices page is role-shaped and every earlier pass ran
as Platform Admin:

| | as Platform Admin | as the manufacturer |
|---|---|---|
| Columns | 10, including `MAH GLN` | 9, no `MAH GLN` |
| Filters | search, status, MAH GLN, from, to | search, status, from, to |
| Row actions on a Pending invoice | Details, CSV, PDF | Details, CSV, PDF, **`Pay`** |

So the ALL-CAPS 10-column list in `workflow.md` describes the admin view. The headers also
render Title Case (`Billing charge`); the capitalisation in the docs is a CSS `text-transform`
that the admin-era capture read as text. Assert columns case-insensitively.

`BIL_INV_011` exists because of that difference: the absence of `MAH GLN` for a manufacturer is
a tenant-isolation property worth asserting, not merely a cosmetic variation.

`BIL_INV_009` depends on `WEB_CSV_009` having run, since it asserts the invoice raised by a
known packing import. `BIL_INV_010` is independent and can run against whatever is listed.

Two `Pending` invoices already existed for GLN 5413868000009 on 2026-09-08 -
`INV-20260908-000006` (1 piece, 7.00 EGP) and `INV-20260908-000002` (434 pieces, 3038.00 EGP) -
so these cases do not require the CSV import to run first.

### BIL_INV_009 was corrected on 2026-09-08, and why

As first written it asserted that a packing import "raises a pending invoice whose Pieces equals
the packs imported". That is wrong about how this platform bills, and running WEB_CSV_009 twice
showed it: no new invoice appeared either time. Instead the MAH's single open pending invoice
ACCUMULATED -- `INV-20260908-000002` was observed at 434, then 473, then 654 pieces across one
day as work continued, and the two imports from WEB_CSV_009 and WEB_CSV_010 are somewhere inside
that growth.

So the billing model is one open invoice per MAH that grows until it is settled, not one invoice
per operation. An equality assertion could only ever pass on a tenant where nothing else was
happening.

The case now reads the Pieces value before the import and asserts it increases by AT LEAST the
packs created. "At least" rather than "exactly" is deliberate and is the honest bound available:
devsim is shared, other parties pack while a case runs, and the counts above moved by more than
this suite created. A case that demanded an exact delta would fail for reasons that have nothing
to do with the code under test.
