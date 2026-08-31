/**
 * Shared envelope/event field negatives.
 *
 * Destruction, Dispensing, Partial Dispensing, Shipping, Receiving and the Return pair
 * each carry the same block of "invalid <field>" cases — event type, action, bizStep,
 * disposition, eventTime, eventTimeZoneOffset, readPoint, bizLocation, schemaVersion,
 * SBDH sender and receiver. Fifteen or so per feature, identical apart from the base
 * document.
 *
 * Rather than repeat them six times, each mutation is defined once here and a feature
 * declares a map of `caseId -> mutation`. That keeps a feature file about its own business
 * rules, and means a change to how (say) an invalid SGLN is expressed happens in one place.
 *
 * Known platform behaviour these encode, established while running the commission suite:
 *   - eventTime and eventTimeZoneOffset are NOT validated at all.
 *   - disposition presence IS checked, its CBV validity is NOT.
 *   - readPoint/bizLocation presence and SGLN form ARE validated, and well.
 *   - schemaVersion is pinned to "2.0".
 *   - A foreign SBDH sender gets a synchronous 403.
 * Features opt into the matching `gap` markers via `KNOWN_GAPS` below.
 */
import { expect } from '@playwright/test'
import {
  submitAndPoll, describeMsgStatus, sglnOf,
  type EpcisDocument, type Role,
} from '../eptts-api'
import type { ApiCase } from './index'

/** Reach into the document's single event. */
export function ev(doc: EpcisDocument): Record<string, unknown> {
  return doc.epcisBody.eventList[0]
}

/** Every reusable field mutation, keyed by a stable semantic name. */
export const MUTATIONS = {
  emptyEpcList: { what: 'an empty epcList', fn: (d: EpcisDocument) => { ev(d).epcList = [] } },
  malformedEpc: {
    what: 'a malformed SGTIN URN',
    fn: (d: EpcisDocument) => { ev(d).epcList = ['urn:epc:id:sgtin:NOT-A-VALID-SGTIN'] },
  },
  ssccInsteadOfSgtin: {
    what: 'an SSCC URN where an SGTIN is required',
    fn: (d: EpcisDocument) => { ev(d).epcList = ['urn:epc:id:sscc:84353083.100000001'] },
  },

  emptyType: { what: 'an empty event type', fn: (d: EpcisDocument) => { ev(d).type = '' } },
  invalidType: { what: 'an unknown event type', fn: (d: EpcisDocument) => { ev(d).type = 'TeleportEvent' } },
  emptyAction: { what: 'an empty action', fn: (d: EpcisDocument) => { ev(d).action = '' } },
  invalidAction: { what: 'an invalid action', fn: (d: EpcisDocument) => { ev(d).action = 'MODIFY' } },
  emptyBizStep: { what: 'an empty bizStep', fn: (d: EpcisDocument) => { ev(d).bizStep = '' } },
  invalidBizStep: { what: 'an invalid bizStep', fn: (d: EpcisDocument) => { ev(d).bizStep = 'teleporting' } },
  emptyDisposition: { what: 'an empty disposition', fn: (d: EpcisDocument) => { ev(d).disposition = '' } },
  invalidDisposition: {
    what: 'a disposition outside the CBV vocabulary',
    fn: (d: EpcisDocument) => { ev(d).disposition = 'teleported' },
  },

  emptyEventTime: { what: 'an empty eventTime', fn: (d: EpcisDocument) => { ev(d).eventTime = '' } },
  invalidEventTime: {
    what: 'a non-ISO-8601 eventTime',
    fn: (d: EpcisDocument) => { ev(d).eventTime = '05-05-2026 10:00' },
  },
  emptyOffset: {
    what: 'an empty eventTimeZoneOffset',
    fn: (d: EpcisDocument) => { ev(d).eventTimeZoneOffset = '' },
  },
  invalidOffset: {
    what: 'an impossible eventTimeZoneOffset',
    fn: (d: EpcisDocument) => { ev(d).eventTimeZoneOffset = '+99:99' },
  },

  emptyReadPoint: { what: 'an empty readPoint', fn: (d: EpcisDocument) => { ev(d).readPoint = { id: '' } } },
  emptyBizLocation: { what: 'an empty bizLocation', fn: (d: EpcisDocument) => { ev(d).bizLocation = { id: '' } } },
  malformedReadPoint: {
    what: 'a malformed readPoint SGLN',
    fn: (d: EpcisDocument) => { ev(d).readPoint = { id: 'NOT-AN-SGLN' } },
  },
  malformedBizLocation: {
    what: 'a malformed bizLocation SGLN',
    fn: (d: EpcisDocument) => { ev(d).bizLocation = { id: 'NOT-AN-SGLN' } },
  },
  mismatchedLocations: {
    what: 'a readPoint and bizLocation belonging to different parties',
    fn: (d: EpcisDocument) => {
      ev(d).readPoint = { id: sglnOf('manufacturer') }
      ev(d).bizLocation = { id: sglnOf('branch') }
    },
  },

  badSchemaVersion: { what: 'an unsupported schemaVersion', fn: (d: EpcisDocument) => { d.schemaVersion = '9.9' } },
  invalidSender: {
    what: 'a malformed SBDH sender identifier',
    fn: (d: EpcisDocument) => { d.sbdh.sender.identifier = 'NOT-A-GLN' },
  },
  invalidReceiver: {
    what: 'a malformed SBDH receiver identifier',
    fn: (d: EpcisDocument) => { d.sbdh.receiver.identifier = 'NOT-A-GLN' },
  },
  // ── shipping / receiving / returns: source, destination, invoice ──
  emptySourceList: {
    what: 'an empty sourceList',
    fn: (d: EpcisDocument) => { ev(d).sourceList = [] },
  },
  malformedSource: {
    what: 'a malformed source SGLN',
    fn: (d: EpcisDocument) => {
      ev(d).sourceList = [{ type: 'urn:epcglobal:cbv:sdt:owning_party', source: 'NOT-AN-SGLN' }]
    },
  },
  emptyDestinationList: {
    what: 'an empty destinationList',
    fn: (d: EpcisDocument) => { ev(d).destinationList = [] },
  },
  malformedDestination: {
    what: 'a malformed destination SGLN',
    fn: (d: EpcisDocument) => {
      ev(d).destinationList = [{ type: 'urn:epcglobal:cbv:sdt:owning_party', destination: 'NOT-AN-SGLN' }]
    },
  },
  emptySourceType: {
    what: 'an empty source type',
    fn: (d: EpcisDocument) => {
      const list = ev(d).sourceList as { type: string; source: string }[] | undefined
      if (list?.length) list[0].type = ''
    },
  },
  emptyDestinationType: {
    what: 'an empty destination type',
    fn: (d: EpcisDocument) => {
      const list = ev(d).destinationList as { type: string; destination: string }[] | undefined
      if (list?.length) list[0].type = ''
    },
  },
  emptyBizTransactionList: {
    what: 'an empty bizTransactionList',
    fn: (d: EpcisDocument) => { ev(d).bizTransactionList = [] },
  },
  emptyInvoice: {
    what: 'an empty invoice / return reference',
    fn: (d: EpcisDocument) => {
      const list = ev(d).bizTransactionList as { type: string; bizTransaction: string }[] | undefined
      if (list?.length) list[0].bizTransaction = ''
    },
  },
  emptyInstanceId: {
    what: 'an empty instanceIdentifier',
    fn: (d: EpcisDocument) => { d.sbdh.documentIdentification.instanceIdentifier = '' },
  },
  emptySender: {
    what: 'an empty SBDH sender identifier',
    fn: (d: EpcisDocument) => { d.sbdh.sender.identifier = '' },
  },
  emptyReceiver: {
    what: 'an empty SBDH receiver identifier',
    fn: (d: EpcisDocument) => { d.sbdh.receiver.identifier = '' },
  },
  badCheckDigitSender: {
    what: 'an SBDH sender GLN whose GS1 check digit is invalid',
    // 8435308300002 is the real GLN; the final digit is deliberately wrong here.
    fn: (d: EpcisDocument) => { d.sbdh.sender.identifier = '8435308300003' },
  },
  unregisteredReceiver: {
    what: 'an SBDH receiver GLN that is not a registered trade partner',
    fn: (d: EpcisDocument) => { d.sbdh.receiver.identifier = '1111111111116' },
  },
  malformedSscc: {
    what: 'a malformed SSCC URN',
    fn: (d: EpcisDocument) => { ev(d).epcList = ['urn:epc:id:sscc:84353083'] },
  },
  injectionInvoice: {
    what: 'a SQL injection payload as the invoice number',
    fn: (d: EpcisDocument) => {
      ev(d).bizTransactionList = [
        { type: 'urn:epcglobal:cbv:btt:desadv', bizTransaction: "' OR 1=1 --" },
      ]
    },
  },

  emptyContextAndType: {
    what: 'an empty @context and document type',
    fn: (d: EpcisDocument) => {
      d['@context'] = []
      ;(d as unknown as Record<string, unknown>).type = ''
    },
  },
} as const

export type MutationName = keyof typeof MUTATIONS

/**
 * Mutations the platform currently ACCEPTS when it should refuse, with the reason.
 * Confirmed on 2026-08-31 against commissioning; the same validation layer serves every
 * event type, so a feature that maps to one of these inherits the marker.
 */
/**
 * Validation gaps observed on the platform, keyed by mutation.
 *
 * IMPORTANT: these are gaps on MOST endpoints, not all of them. The validator is not
 * uniform — `/Dispensation`, for instance, rejects a malformed eventTime that
 * `/scp/SendEPCIS` accepts. A feature whose endpoint DOES validate correctly must list the
 * affected case ids in `validates`, or the marker claims a defect that is not there and
 * hides the fact that this endpoint gets it right.
 */
export const KNOWN_GAPS: Partial<Record<MutationName, string>> = {
  emptyEventTime: 'an empty eventTime is accepted and processed successfully',
  invalidEventTime: 'a non-ISO-8601 eventTime is accepted and processed successfully',
  emptyOffset: 'an empty eventTimeZoneOffset is accepted and processed successfully',
  invalidOffset: 'eventTimeZoneOffset +99:99 is accepted and processed successfully',
  invalidDisposition: 'a disposition outside the CBV vocabulary is accepted (presence is checked, validity is not)',
  emptyEpcList: 'an event with zero EPCs is accepted and reported successful',
}

/**
 * Assert the platform refused a document — synchronously (4xx, nothing queued) or
 * asynchronously (202 then MsgStatusQuery FAILED). Both count as a refusal; only
 * acceptance is a failure.
 */
export async function expectRejected(role: Role, doc: EpcisDocument, what: string): Promise<void> {
  const { submitStatus, submitBody, msg } = await submitAndPoll(role, doc)
  if (submitStatus >= 400) {
    console.log(`[neg] ${what}: rejected synchronously ${submitStatus} ${JSON.stringify(submitBody).slice(0, 170)}`)
    expect(JSON.stringify(submitBody), `${what}: the rejection states a reason`).toBeTruthy()
    return
  }
  console.log(`[neg] ${what}: accepted (${submitStatus}) -> ${describeMsgStatus(msg)}`)
  expect(msg.timedOut, `${what}: MsgStatusQuery never resolved — ${describeMsgStatus(msg)}`).toBe(false)
  expect(msg.state, `${what}: the platform ACCEPTED input it should refuse — ${describeMsgStatus(msg)}`)
    .toBe('FAILED')
}

/** Assert the platform accepted and successfully processed a document. */
export async function expectAccepted(role: Role, doc: EpcisDocument, what: string): Promise<void> {
  const { submitStatus, msg } = await submitAndPoll(role, doc)
  expect(submitStatus, `${what}: accepted for processing`).toBe(202)
  expect(msg.state, `${what}: ${describeMsgStatus(msg)}`).toBe('SUCCESS')
}

export interface FieldCaseOpts {
  feature: string
  role: Role
  /** Verb used in the generated title, e.g. "destroying", "dispensing". */
  verb: string
  /** Build a valid document for this feature, including any fixture setup it needs. */
  baseDoc: () => Promise<EpcisDocument>
  /** caseId -> mutation name. */
  map: Partial<Record<string, MutationName>>
  /** Extra gap markers specific to this feature, merged over KNOWN_GAPS. */
  gaps?: Partial<Record<string, string>>
  /**
   * Case ids where this endpoint DOES validate correctly, despite the mutation being a
   * known gap elsewhere. Suppresses the expected-failure marker so the case is a plain
   * pass — which is the truth, and stops the suite implying a defect that is not present.
   */
  validates?: string[]
  /**
   * How to submit and assert a refusal. Defaults to /scp/SendEPCIS via `expectRejected`.
   * Dispensing MUST override this — it posts to /Dispensation, and submitting its
   * documents to /scp/SendEPCIS would test the wrong endpoint entirely while still
   * producing a plausible-looking refusal.
   */
  reject?: (role: Role, doc: EpcisDocument, what: string) => Promise<void>
}

/** Turn a feature's `caseId -> mutation` map into ready ApiCases. */
export function fieldCases(opts: FieldCaseOpts): ApiCase[] {
  const out: ApiCase[] = []
  for (const [id, name] of Object.entries(opts.map)) {
    if (!name) continue
    const m = MUTATIONS[name]
    const gap = opts.validates?.includes(id) ? undefined : (opts.gaps?.[id] ?? KNOWN_GAPS[name])
    out.push({
      id,
      feature: opts.feature,
      title: `${opts.verb} with ${m.what} is refused`,
      slow: true,
      expectFail: gap ? `platform validation gap: ${gap}` : undefined,
      run: async () => {
        const doc = await opts.baseDoc()
        m.fn(doc)
        const reject = opts.reject ?? expectRejected
        await reject(opts.role, doc, `${id} ${m.what}`)
      },
    })
  }
  return out
}
