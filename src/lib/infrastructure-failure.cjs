/**
 * Did a test fail because the PLATFORM was unreachable, rather than because the behaviour
 * under test was wrong?
 *
 * This matters more than it looks. During the first full run the host returned 5xx for roughly
 * two minutes and took out 94 tests in one burst. Recording those as `fail` would have invented
 * ~80 defects that do not exist and buried the ~29 real ones. So an infrastructure failure is
 * never recorded as a result — the case is reported as not executed and must be re-run.
 *
 * Deliberately conservative: a 5xx, a connection error, or a failure to authenticate at all
 * says nothing about the endpoint under test. Note that 502/503/504 are matched but NOT 500 —
 * a genuine unhandled server error on a specific request IS a defect worth reporting, whereas
 * a gateway refusing every request is not.
 *
 * WHY THIS IS A SHARED .cjs AND NOT COPIED INTO BOTH CALLERS.
 * Two paths record a run: scripts/eptts-record-run.js (a CLI suite run) and
 * src/app/api/[app]/automation/[project]/run/route.ts (a Hub replay). Only the script had this
 * guard, so a replay during an outage wrote a real `fail` onto a test case: TC_COMM_006 was
 * replayed twice while ngrok answered ERR_NGROK_727 to every request, and its recorded status
 * went from pass to fail with a note blaming the API key. A second copy of these patterns would
 * drift the moment one caller learned about a new failure mode, so both now require this file.
 *
 * @param {string | null | undefined} error First error message from the run.
 * @returns {boolean} True when the failure says nothing about the thing under test.
 */
function isInfrastructureFailure(error) {
  if (!error) return false
  // One exception to "auth failure = outage": a second-entity ("ef_") key rejected with a clean
  // 401 is this tenant not having that trade partner provisioned. That is permanent, so calling
  // it an outage parks the case on a re-run list forever. Only 401 — the same roles answered 404
  // when the relay tunnel stopped routing, and that IS an outage.
  if (/auth failed for role "ef_[a-z_]+": 401/i.test(error)) return false
  return (
    /\b(50[234])\b|Bad Gateway|Service Unavailable|Gateway Time-?out|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|socket hang up|connect Timeout|auth failed for role/i
      .test(error)
    // A request that never came back is the platform being unreachable or wedged, not a defect
    // in the thing under test. Missing this meant a storage outage on SendEPCIS — which the
    // platform reports as 503 E003 "durable object storage not confirmed" — was recorded as a
    // genuine failure for every case that touched the write path, because our own timeout fired
    // first and all we kept was "Timeout 45000ms exceeded".
    || /apiRequestContext\.\w+: Timeout \d+ms exceeded|durable object storage not confirmed|temporarily unavailable/i
      .test(error)
    // OUR harness dying is not a verdict either. A killed or crashed Playwright worker reports
    // "worker process exited unexpectedly" for every case it still had in hand — a re-verify run
    // that was stopped near the end left 8 cases carrying that message, and without this they
    // would have been recorded as 8 platform defects. code=3221225794 is Windows
    // STATUS_DLL_INIT_FAILED, which is what a terminated worker looks like here.
    || /worker process exited unexpectedly|Worker teardown timeout|Test ended\b/i.test(error)
    // An ngrok endpoint refusing traffic before it ever reaches the platform. The relay answered
    // 403 with an ERR_NGROK_727 HTML body to every request, including /health, so nothing behind
    // it was exercised at all.
    || /ERR_NGROK_\d+/i.test(error)
  )
}

/**
 * Did the test fail because this tenant does not meet a PRECONDITION the case needs, rather
 * than because the behaviour under test is wrong?
 *
 * Unlike an outage this will not fix itself on a re-run, so it is recorded as blocked with the
 * reason instead of being held back silently. Shared for the same reason as the predicate
 * above: a Hub replay was writing `fail` where a CLI run wrote `blocked` for the identical
 * refusal, so the dashboard's verdict depended on which button produced it.
 *
 * @param {string | null | undefined} error First error message from the run.
 * @returns {boolean} True when the tenant, not the endpoint, is why the case could not run.
 */
function isUnmetPrecondition(error) {
  if (!error) return false
  return /no (?:commissionable|dispensable|partial-dispense) GTIN is configured for this environment/i.test(error)
    // NOT the Dawana refusal. It was listed here while every product on the relay tenant really
    // was isDawanaIntegration:true, which made the refusal correct and the case merely
    // un-runnable. That is no longer so: all seven products now read
    // isDawanaIntegration:false from both the masar and registry services, and the dispensing
    // event still refuses them as Dawana-integrated — the rule is reading a stale source, which
    // is a defect and must be recorded as a failure rather than hidden as missing test data.
    // If a product is genuinely Dawana-integrated again, its refusal IS correct; that is a
    // judgement about the product, which this script cannot make from the error text alone.
    // A second-entity ("ef_") key REJECTED with 401 means this tenant has no such trade partner
    // provisioned — permanent, so holding it back for a re-run that can never succeed just hides
    // it. Pinned to 401: the same roles answered 404 once the relay tunnel stopped routing, and
    // that is an outage, which isInfrastructureFailure must keep claiming first.
    || /auth failed for role "ef_[a-z_]+": 401/i.test(error)
    // A FIXTURE step refused because the Pricing Team has not approved the product's registered
    // price, while billing is enforcing. The case never got to exercise its own rule, so calling
    // it a failure blames the endpoint for a missing precondition on the tenant's data.
    //
    // Recorded on 2026-09-07: all seven products read pricingReviewStatus=pending, and during an
    // enforcing window 24 packing events were refused with "Cannot seal this container: the
    // Pricing Team has not approved the registered price". That took out most of the packing,
    // dispensing and destruction fixtures at once. Matched only when the refusal names the
    // pricing approval — a case whose OWN subject is the pricing gate (TS_PACK_018, TC_COMM_045)
    // asserts the refusal itself and passes, so it never reaches this predicate.
    || /the Pricing Team has not approved the registered price|billing is enforcing and cannot invoice an unapproved price/i
      .test(error)
    // A FIXTURE step refused because the tenant owes money. Once pricing approval cleared, this
    // became the next link in the same chain: 24 cases whose fixture ships stock were refused
    // with "Shipping blocked by unpaid invoices. Outstanding cents: 68200", where the outstanding
    // balance is invoices OUR OWN test volume generated. It is correct behaviour now that
    // billing enforces, and it says nothing about shipping, so the case is blocked rather than
    // failed. NOTE: this being legitimate depends on billing actually enforcing — the earlier
    // finding was that the same hold applied while GET /billing/posture reported
    // {mode: advisory, enforce: false}, which was a defect. Re-check the posture before
    // treating a hold as expected.
    || /blocked by unpaid invoices/i.test(error)
}

module.exports = { isInfrastructureFailure, isUnmetPrecondition }
