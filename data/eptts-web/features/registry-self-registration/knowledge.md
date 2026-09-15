# Self-Registration — what you need to know before testing it

## The feature name is misleading, and it changes the test design

This is not "a company registers itself from nothing". It is **assisted onboarding for a company
EDA already holds a profile for**. The applicant authenticates with EDA Company Profile
credentials, and the company identity — name EN/AR, address EN/AR, licence number, tax number — is
then rendered **read-only** from that profile.

The consequence for every case here: **a test cannot choose which company it registers.** The
company is whichever one `EPTTS_EDA_PROFILE_ID` belongs to. There is no field in which to name a
different one, and that is a security property worth protecting rather than a limitation to work
around — the registry has no delete control, so an editable company name would let one applicant
register another company's identity irrecoverably. `REG_SRG_003` asserts it field by field.

On devsim, `user-152` resolves to **Marcyrl pharmaceuticals industries - MPI** (licence 62814, tax
205131794). If a test needs a *different* company, it needs that company's EDA credentials — not
different form input.

## Validation messages are transient toasts. Observe them, never sample them

This is the single most expensive lesson in this feature. Validation failures render as
`div.toast.error` and are removed again shortly afterwards. Read the DOM a few seconds after
clicking "Verify & Continue" and you find **nothing at all**: no message, no invalid field, no
network request — while the button sits there `disabled: false`.

That reads exactly like an enabled submit button that silently does nothing, and it was almost
filed as a P1. It is wrong. `Ke()`, the click handler, validates every field and fires the
appropriate message; the toast appears at **+0ms** and is gone before a late read. The same shape
bit this suite on the billing portal, whose toasts are removed after 3500ms.

`onboarding.page.ts` therefore arms a `MutationObserver` **before** the click and asserts on what
was captured, never on what is currently on screen.

## Nothing is transmitted until every rule passes

`PUT /onboarding/registration/company` is reached only after all validation succeeds. So every
negative case in this feature **writes nothing** and is safe to run repeatedly against production —
which is why `REG_SRG_004`–`008` carry no write gate, and why they can assert `requestSent: false`
to *prove* nothing was stored rather than assuming it.

It also means `QA_FOCAL_POINT` placeholder values never leave the browser in a negative case. They
are deliberately self-identifying ("QA DO NOT USE"), so if one ever appears in the registry it
means a negative case submitted when it should not have.

## The handler stops at the first failure

Validation order is: GLN → GCP → district → focal-point names → e-mail/phone → national ID →
expiry → job titles. A case that wants to prove the national-ID rule **must satisfy everything
before it**, or it will get a district complaint and quietly test the wrong thing.

## Some rules are enforced at entry, not at validation

`#tnt-gln` has `maxlength=13` and `#tnt-gcp` has `maxlength=12`. An over-length value cannot be
typed — it truncates. For GLN, typing 14 digits truncates to a *valid* 13-digit GLN and validation
moves on, so asserting a length complaint there fails against **correct** behaviour. Assert what
the field can hold instead. The first draft of `REG_SRG_004` got this wrong.

## What the client does not check

- **The GLN check digit.** The rule is `/^\d{13}$/` — digits and length only. A GLN with a bad
  check digit passes this step and is left to the GS1 registry validation the page warns about.
- **The national ID's check digit or encoded birth date.** Length only, again.
- **GS1 ownership.** The page states the GLN/GCP will be validated against the GS1 registry and
  the applicant cannot proceed until that succeeds. That happens server-side on the PUT, so it is
  only reachable by a case that satisfies every client rule first.

## Test data created on production

Nothing yet. `REG_SRG_001`–`008` create nothing by construction. `REG_SRG_009` is the only case
that advances a real registration and is currently blocked on data, because it cannot invent
either half of what it needs: a **GS1-registered GLN/GCP belonging to the logged-in company**, and
a focal point's **real 14-digit national ID**. Fabricating the latter would write an identity
document number into a national registry with no delete control.

Note also that `POST /onboarding/registration/submit` takes `{newPassword, newPasswordConfirm}` —
completing a registration **mints a platform credential**, so it is not repeatable against the same
profile and its password must live in `automation-hub/.env`, never in `data/`.
