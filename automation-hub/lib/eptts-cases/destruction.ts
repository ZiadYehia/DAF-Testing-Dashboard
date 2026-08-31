/**
 * EPTTS_API_05 — Destruction (29 cases).
 *
 * `ObjectEvent`, `action: DELETE`, `bizStep: destroying`, `disposition: destroyed`.
 *
 * Destruction is IRREVERSIBLE — a destroyed pack can never re-enter the supply chain.
 * That shapes the suite two ways:
 *
 *   - Each positive case consumes its own freshly commissioned pack, never a shared one.
 *   - The strongest proof a destruction took effect is that a LATER operation on the pack
 *     is refused, so TC_DEST_004 asserts that rather than trusting the destroy's own
 *     SUCCESS.
 *
 * Fifteen of the 29 are envelope/event field negatives shared with every other feature —
 * see field-mutations.ts.
 */
import { expect } from '@playwright/test'
import {
  packOf, epcisDocument, destructionEvent, dispensingEvent, dispensation,
  freshSgtin, sglnOf, glnFor, describeMsgStatus, pollMsgStatus,
  type EpcisDocument,
} from '../eptts-api'
import type { ApiCase } from './index'
import { commissioned, commissionedMixed, inTransitToBranch, atPharmacy } from './fixtures'
import { fieldCases, expectAccepted, expectRejected, type MutationName } from './field-mutations'

const FEATURE = 'api-destruction'
const MFG = () => glnFor('manufacturer')

function destroyDoc(epcList: string[]): EpcisDocument {
  return epcisDocument(
    [destructionEvent({ epcList, readPointSgln: sglnOf('manufacturer') })],
    { senderGln: MFG(), receiverGln: MFG() },
  )
}

/** A valid destruction document over a freshly commissioned pack — the mutation base. */
async function baseDoc(): Promise<EpcisDocument> {
  const c = await commissioned(1)
  return destroyDoc(c.sgtins)
}

async function expectDestroyed(sgtin: string): Promise<void> {
  const v = await packOf('manufacturer', sgtin)
  console.log(`[dest] ${sgtin} status=${v.pack?.status}`)
  expect(v.pack?.status, `${sgtin} is destroyed`).toBe('destroyed')
}

// ─── business cases ──────────────────────────────────────────────────────────

const business: ApiCase[] = [
  {
    id: 'TC_DEST_001', feature: FEATURE, slow: true,
    title: 'destroy a valid active SGTIN',
    run: async () => {
      const c = await commissioned(1)
      await expectAccepted('manufacturer', destroyDoc(c.sgtins), 'destroy one pack')
      await expectDestroyed(c.sgtins[0])
    },
  },
  {
    id: 'TC_DEST_002', feature: FEATURE, slow: true,
    title: 'destroy multiple valid SGTINs in a single request',
    run: async () => {
      const c = await commissioned(3)
      await expectAccepted('manufacturer', destroyDoc(c.sgtins), 'destroy three packs')
      for (const s of c.sgtins) await expectDestroyed(s)
    },
  },
  {
    id: 'TC_DEST_003', feature: FEATURE, slow: true,
    title: 'destroy SGTINs of different products in a single request',
    run: async () => {
      // The sheet says "different batches"; a mixed-GTIN pair is the stronger version of
      // the same idea — the batch/lot is per commissioning event, and two GTINs
      // necessarily come from two events.
      const c = await commissionedMixed()
      await expectAccepted('manufacturer', destroyDoc(c.sgtins), 'destroy across products')
      for (const s of c.sgtins) await expectDestroyed(s)
    },
  },
  {
    id: 'TC_DEST_004', feature: FEATURE, slow: true,
    title: 'a destroyed SGTIN is permanently out of the supply chain',
    run: async () => {
      const c = await commissioned(1)
      await expectAccepted('manufacturer', destroyDoc(c.sgtins), 'destroy the pack')
      await expectDestroyed(c.sgtins[0])

      // The real proof: a later operation must be refused. Re-destroying is the cheapest
      // such operation that needs no extra custody setup.
      await expectRejected('manufacturer', destroyDoc(c.sgtins), 'operate on a destroyed pack')

      // …and it must still read as destroyed afterwards, not have been resurrected.
      await expectDestroyed(c.sgtins[0])
    },
  },
  {
    id: 'TC_DEST_006', feature: FEATURE, slow: true,
    title: 'destroying a non-existent SGTIN is refused',
    run: async () => {
      // Well-formed URN, never commissioned.
      await expectRejected('manufacturer', destroyDoc([freshSgtin()]), 'never-commissioned pack')
    },
  },
  {
    id: 'TC_DEST_008', feature: FEATURE, slow: true,
    title: 'destroying with duplicate SGTINs in the EPC list is refused',
    run: async () => {
      const c = await commissioned(1)
      await expectRejected('manufacturer', destroyDoc([c.sgtins[0], c.sgtins[0]]), 'duplicate EPCs')
    },
  },
  {
    id: 'TC_DEST_009', feature: FEATURE, slow: true,
    title: 'a request mixing valid and invalid SGTINs is refused as a whole',
    run: async () => {
      const c = await commissioned(1)
      const ghost = freshSgtin()
      await expectRejected('manufacturer', destroyDoc([c.sgtins[0], ghost]), 'one valid + one non-existent')

      // All-or-nothing matters: a partially applied destruction would leave the caller
      // with no way to know which packs died.
      const v = await packOf('manufacturer', c.sgtins[0])
      expect(v.pack?.status, 'the valid pack was NOT destroyed by the rejected request').not.toBe('destroyed')
    },
  },
  {
    id: 'TC_DEST_010', feature: FEATURE, slow: true,
    title: 'destroying an already-destroyed SGTIN is refused',
    run: async () => {
      const c = await commissioned(1)
      await expectAccepted('manufacturer', destroyDoc(c.sgtins), 'first destroy')
      await expectRejected('manufacturer', destroyDoc(c.sgtins), 'second destroy')
    },
  },
  {
    id: 'TC_DEST_011', feature: FEATURE, slow: true,
    title: 'destroying an expired SGTIN',
    // Destroying expired stock is the normal reason to destroy anything, so this matters —
    // but it cannot be exercised here, because expired stock cannot be brought into
    // existence through the API in the first place.
    skip: 'blocked: expired stock cannot be created through the API. Commissioning with a past itemExpirationDate is itself refused ("Cannot commission expired stock: itemExpirationDate 2020-01-01 is in the past"), so the precondition is unreachable. Needs stock aged past its expiry, or a back-dated record created directly in the platform.',
    run: async () => { /* unreachable while skipped */ },
  },
  {
    id: 'TC_DEST_012', feature: FEATURE, slow: true,
    title: 'destroying an SGTIN that is in transit is refused',
    run: async () => {
      const t = await inTransitToBranch(1)
      // The manufacturer has despatched it; destroying it now would strand the receiver.
      await expectRejected('manufacturer', destroyDoc([t.sgtins[0]]), 'destroy an in-transit pack')
    },
  },
  {
    id: 'TC_DEST_013', feature: FEATURE, slow: true,
    title: 'destroying an already-dispensed SGTIN is refused',
    run: async () => {
      const a = await atPharmacy(1)
      // Dispense it first, as the pharmacy.
      const disp = epcisDocument(
        [dispensingEvent({ epcList: [a.sgtins[0]], readPointSgln: sglnOf('pharmacy') })],
        { senderGln: glnFor('pharmacy'), receiverGln: glnFor('branch') },
      )
      const res = await dispensation('pharmacy', disp)
      // /Dispensation acknowledges with 200 (not 202 like /scp/SendEPCIS) and is still async.
      expect([200, 202], `fixture: dispense acknowledged — got ${res.status()}`).toContain(res.status())
      const msg = await pollMsgStatus('pharmacy', disp.sbdh.documentIdentification.instanceIdentifier)
      expect(msg.state, `fixture: dispense — ${describeMsgStatus(msg)}`).toBe('SUCCESS')

      await expectRejected('manufacturer', destroyDoc([a.sgtins[0]]), 'destroy a dispensed pack')
    },
  },
  {
    id: 'TC_DEST_014', feature: FEATURE, slow: true,
    title: 'destroying a pack owned by another party is refused',
    run: async () => {
      const c = await commissioned(1)
      // The branch never owned this pack, so it must not be able to destroy it.
      const doc = epcisDocument(
        [destructionEvent({ epcList: c.sgtins, readPointSgln: sglnOf('branch') })],
        { senderGln: glnFor('branch'), receiverGln: glnFor('branch') },
      )
      await expectRejected('branch', doc, 'branch destroying a manufacturer-owned pack')

      const v = await packOf('manufacturer', c.sgtins[0])
      expect(v.pack?.status, 'the pack survives the unauthorised attempt').not.toBe('destroyed')
    },
  },
]

// ─── shared field negatives ──────────────────────────────────────────────────

const FIELD_MAP: Partial<Record<string, MutationName>> = {
  TC_DEST_005: 'emptyEpcList',
  TC_DEST_007: 'malformedEpc',
  TC_DEST_015: 'invalidType',
  TC_DEST_016: 'invalidAction',
  TC_DEST_017: 'invalidBizStep',
  TC_DEST_018: 'invalidDisposition',
  TC_DEST_019: 'invalidEventTime',
  TC_DEST_020: 'invalidOffset',
  TC_DEST_021: 'emptyReadPoint',
  TC_DEST_022: 'emptyBizLocation',
  TC_DEST_023: 'malformedReadPoint',
  TC_DEST_024: 'malformedBizLocation',
  TC_DEST_025: 'mismatchedLocations',
  TC_DEST_027: 'badSchemaVersion',
  TC_DEST_028: 'invalidSender',
  TC_DEST_029: 'invalidReceiver',
}

const duplicateRequest: ApiCase = {
  id: 'TC_DEST_026', feature: FEATURE, slow: true,
  title: 'a duplicate destruction request is refused',
  run: async () => {
    const c = await commissioned(1)
    await expectAccepted('manufacturer', destroyDoc(c.sgtins), 'first destruction')
    await expectRejected('manufacturer', destroyDoc(c.sgtins), 'identical second destruction')
  },
}

export const DESTRUCTION_CASES: ApiCase[] = [
  ...business,
  duplicateRequest,
  ...fieldCases({ feature: FEATURE, role: 'manufacturer', verb: 'destroying', baseDoc, map: FIELD_MAP }),
]
