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

module.exports = { isInfrastructureFailure }
