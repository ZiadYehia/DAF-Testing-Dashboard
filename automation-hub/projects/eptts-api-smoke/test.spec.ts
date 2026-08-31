/**
 * EPTTS API — contract smoke.
 *
 * Proves the whole chain works against production before the eleven per-feature
 * projects rely on it: authenticate all three roles, commission a fresh pack,
 * poll it to a terminal state, verify its state, then aggregate it into an SSCC.
 *
 * Browser-free: uses Playwright's `request` API only. Every EPC is minted with a
 * run-scoped serial, so repeated runs never collide on an already-commissioned
 * identifier — which matters because this writes real EPCIS events to production.
 */
import { test, expect } from "@playwright/test";
import {
  authenticate,
  rawAuth,
  decodeClaims,
  apiKeyFor,
  glnFor,
  platformRoleFor,
  submitAndPoll,
  pollMsgStatus,
  sendEpcis,
  verifyProduct,
  getMasar,
  dispensation,
  epcisDocument,
  commissionEvent,
  aggregationEvent,
  freshSgtin,
  freshSscc,
  sglnFor,
  uniqueSerial,
  bodyOf,
  errorOf,
  runId,
  disposeApi,
  MFG_GCP_LENGTH,
  MFG_GTINS,
  type Role,
} from "../../lib/eptts-api";

// API-only: no storageState, no browser, no login bootstrap.
// Deliberately NOT file-level serial: only the commission -> pack pair is ordered
// (see the describe.serial below). File-level serial made one unrelated failure
// skip every later test.

const MFG_GLN = () => glnFor("manufacturer");
const MFG_SGLN = () => sglnFor(MFG_GLN(), MFG_GCP_LENGTH);

test.afterAll(async () => {
  await disposeApi();
});

test("SMOKE-01 — every role authenticates and receives a scoped B2B token", async () => {
  const roles: Role[] = ["manufacturer", "branch", "pharmacy"];
  for (const role of roles) {
    const result = await rawAuth(apiKeyFor(role));
    expect(result.status, `${role}: POST /auth`).toBe(200);
    expect(result.accessToken, `${role}: access_token present`).toBeTruthy();
    expect(result.tokenType, `${role}: token_type`).toBe("Bearer");
    // 15-minute lifetime — the helper refreshes 2 min early.
    expect(result.expiresIn, `${role}: expires_in`).toBe(900);

    const claims = decodeClaims(result.accessToken!);
    expect(claims.source, `${role}: token source`).toBe("b2b");
    expect(claims.principalType, `${role}: principal type`).toBe("b2b_partner");
    expect(claims.role, `${role}: platform role`).toBe(platformRoleFor(role));
    expect(claims.entityGln, `${role}: bound GLN`).toBe(glnFor(role));
  }
});

test("SMOKE-02 — /auth rejects a missing and an invalid apikey", async () => {
  const missing = await rawAuth(null);
  expect(missing.status, "no apikey header").toBe(401);
  expect(missing.accessToken).toBeNull();

  const invalid = await rawAuth(
    "not-a-real-key-0000000000000000000000000000000000000000000000000000",
  );
  expect(invalid.status, "invalid apikey").toBe(401);
  expect(invalid.accessToken).toBeNull();
});

test("SMOKE-03 — the apikey header is not required once a token is held", async () => {
  // Verified behaviour: after /auth, only Authorization matters. GET /epcis is a
  // read available to every role, so it is the safest probe for this.
  const res = await getMasar("manufacturer", "/epcis?limit=1");
  expect(res.status(), "GET /epcis with Bearer only").toBe(200);
  const body = (await bodyOf(res)) as { items?: unknown[] };
  expect(Array.isArray(body.items), "items array present").toBe(true);
});

test("SMOKE-04 — role authorization is enforced on /Dispensation", async () => {
  // A manufacturer must not be able to dispense. The 403 body names the allowed roles.
  const res = await dispensation("manufacturer", {});
  expect(res.status(), "manufacturer POST /Dispensation").toBe(403);
  const err = await errorOf(res);
  expect(err.message, "denial names the permitted roles").toContain(
    "available to",
  );

  // A pharmacy reaches the handler and is rejected on the body instead (400, not 403).
  const allowed = await dispensation("pharmacy", {});
  expect(allowed.status(), "pharmacy POST /Dispensation").toBe(400);
});

test("SMOKE-05 — a document with no SBDH is rejected synchronously with code E003", async () => {
  // The synchronous-rejection shape: malformed enough that nothing is queued and
  // MsgStatusQuery is never involved. Contrast with a well-formed request that
  // fails a business rule, which returns 202 and only later reports FAILED.
  const res = await sendEpcis("manufacturer", {});
  expect(res.status(), "no SBDH is rejected up front").toBe(400);

  const err = await errorOf(res);
  console.log(
    `[smoke] rejection shape=${err.shape} code=${err.code} message=${err.message}`,
  );
  expect(err.shape, "/scp/SendEPCIS uses the EPCIS error envelope").toBe(
    "epcis",
  );
  expect(err.code, "missing-SBDH error code").toBe("E003");
  expect(err.message, "rejection states a reason").toContain("SBDH");
});

test("SMOKE-05b — an empty eventList is ACCEPTED (202), which looks wrong", async () => {
  // Recorded because it is surprising and contradicts the suite's assumption: a
  // well-formed envelope carrying ZERO events is accepted rather than rejected.
  // Asserting the real behaviour keeps the smoke green and makes any future fix
  // visible as a failure here. Flagged as a probable defect.
  const res = await sendEpcis(
    "manufacturer",
    epcisDocument([], {
      senderGln: MFG_GLN(),
      receiverGln: MFG_GLN(),
    }),
  );
  const body = await bodyOf(res);
  console.log(
    `[smoke] empty eventList -> ${res.status()} ${JSON.stringify(body).slice(0, 300)}`,
  );
  expect(res.status(), "empty eventList is accepted (probable defect)").toBe(
    202,
  );
});

// Commission then pack: genuinely ordered, so this pair is serial on its own.
test.describe.serial("commission -> pack chain", () => {
  let commissionedSgtin: string | null = null;

  test("SMOKE-06 — commission a fresh pack and poll it to a terminal state", async () => {
    test.slow(); // asynchronous processing: submit + poll can take a while

    const gtin = MFG_GTINS[0];
    const sgtin = freshSgtin(gtin);
    const lot = `ZTG-${runId()}`;
    console.log(
      `[smoke] run=${runId()} commissioning ${sgtin} (gtin ${gtin}, lot ${lot})`,
    );

    const doc = epcisDocument(
      [
        commissionEvent({
          epcList: [sgtin],
          lotNumber: lot,
          expiryDate: "2030-12-31",
          readPointSgln: MFG_SGLN(),
        }),
      ],
      { senderGln: MFG_GLN(), receiverGln: MFG_GLN() },
    );

    const { submitStatus, submitBody, instanceIdentifier, msg } =
      await submitAndPoll("manufacturer", doc);
    console.log(
      `[smoke] submit=${submitStatus} iid=${instanceIdentifier} polls=${msg.pollCount} state=${msg.state}`,
    );
    console.log(
      `[smoke] submit body: ${JSON.stringify(submitBody).slice(0, 400)}`,
    );
    console.log(
      `[smoke] msg body:    ${JSON.stringify(msg.body).slice(0, 400)}`,
    );

    // 202 Accepted means queued, not applied — the state assertion below is the real check.
    expect(submitStatus, "commission accepted").toBeLessThan(300);
    expect(
      msg.timedOut,
      `MsgStatusQuery timed out after ${msg.pollCount} polls`,
    ).toBe(false);
    expect(msg.state, "terminal state reached").not.toBeNull();
    expect(msg.state, "commission succeeded").toMatch(/SUCCESS|COMPLETED/);

    // The pack must now exist. VerifyProduct answers 200 with verified:false when it
    // does not, so the status code alone proves nothing.
    const vp = await verifyProduct("manufacturer", sgtin);
    expect(vp.status(), "VerifyProduct reachable").toBe(200);
    const vpBody = (await bodyOf(vp)) as {
      verified?: boolean;
      alerts?: string[];
      pack?: unknown;
    };
    console.log(
      `[smoke] VerifyProduct: ${JSON.stringify(vpBody).slice(0, 400)}`,
    );
    expect(
      vpBody.alerts ?? [],
      "the commissioned pack is no longer NOT_FOUND",
    ).not.toContain("NOT_FOUND");

    commissionedSgtin = sgtin;
  });

  test("SMOKE-07 — aggregate the commissioned pack into a fresh SSCC", async () => {
    test.slow();
    const sgtin = commissionedSgtin;
    test.skip(!sgtin, "SMOKE-06 did not produce a commissioned SGTIN");

    const sscc = freshSscc();
    console.log(`[smoke] packing ${sgtin} into ${sscc}`);

    const doc = epcisDocument(
      [
        aggregationEvent({
          parentID: sscc,
          childEPCs: [sgtin!],
          action: "ADD",
          readPointSgln: MFG_SGLN(),
        }),
      ],
      { senderGln: MFG_GLN(), receiverGln: MFG_GLN() },
    );

    const { submitStatus, msg } = await submitAndPoll("manufacturer", doc);
    console.log(
      `[smoke] pack submit=${submitStatus} polls=${msg.pollCount} state=${msg.state}`,
    );
    console.log(
      `[smoke] pack msg body: ${JSON.stringify(msg.body).slice(0, 400)}`,
    );

    expect(submitStatus, "packing accepted").toBeLessThan(300);
    expect(msg.timedOut, "packing reached a terminal state").toBe(false);
    expect(msg.state, "packing succeeded").toMatch(/SUCCESS|COMPLETED/);
  });
});

test("SMOKE-08 — MsgStatusQuery answers 404 for an unknown identifier", async () => {
  // This is why the poller retries on 404 rather than failing. Assert it directly
  // with a single short poll instead of inferring it.
  const msg = await pollMsgStatus(
    "manufacturer",
    `ztg-nonexistent-${uniqueSerial()}`,
    {
      timeoutMs: 4_000,
      intervalMs: 1_500,
    },
  );
  console.log(
    `[smoke] unknown iid -> status=${msg.status} polls=${msg.pollCount} timedOut=${msg.timedOut}`,
  );
  expect(msg.status, "unknown instanceIdentifier returns 404").toBe(404);
  expect(
    msg.timedOut,
    "the poller keeps retrying rather than treating 404 as terminal",
  ).toBe(true);
  expect(
    JSON.stringify(msg.body),
    "the 404 explains it may still be initializing",
  ).toMatch(/No message was found|initializing/i);
});
