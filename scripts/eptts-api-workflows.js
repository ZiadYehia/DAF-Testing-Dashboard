#!/usr/bin/env node
/**
 * Generate workflow.md for each EPTTS API feature under data/eptts-api/features/.
 *
 * Usage:
 *   node scripts/eptts-api-workflows.js            # dry run
 *   node scripts/eptts-api-workflows.js --write
 *
 * The 11 API features share one document structure (Feature Details, Business Purpose,
 * Request Contract, Happy Path, Edge Cases, Notes) and differ only in their EPCIS event
 * shape and business rules, so the shared skeleton lives here and the per-feature
 * substance lives in FEATURES below. Request shapes are transcribed from
 * "Masar B2B API — Role Scenarios.postman_collection.json".
 *
 * Idempotent: re-running regenerates identical files.
 */
const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')
const FEATURES_DIR = path.join(REPO, 'data', 'eptts-api', 'features')
const WRITE = process.argv.includes('--write')

const ASYNC_HAPPY = [
  'Authenticate: `POST /auth` with the role `apikey` header; capture `access_token`.',
  'Build the EPCIS document: SBDH sender = the acting GLN, receiver = the counterparty GLN, and a fresh UUID as `instanceIdentifier`.',
  'Submit: `POST /scp/SendEPCIS` with `apikey` + `Authorization: Bearer <token>` and `Content-Type: application/json`.',
  'Receive **`202 Accepted`** — the submission is queued, not applied.',
  'Poll `POST /MsgStatusQuery` with `{ "instanceIdentifier": "<the uuid>" }` until a terminal state.',
  'Assert `SUCCESS`.',
  'Confirm the resulting pack state with `POST /VerifyProduct` (and/or `GET /epcis` for the event record).',
]

const COMMON_EDGE = [
  '**Synchronous vs asynchronous rejection are different behaviours.** A malformed request (missing mandatory field, empty `epcList`, bad `Content-Type`) is rejected `400` with *no* event queued and *no* `MsgStatusQuery` record. A well-formed request that fails a business rule returns `202` and `MsgStatusQuery` later returns `FAILED`. A case that asserts the wrong one of these will pass against broken behaviour.',
  '**GLN ownership** — acting on an EPC owned by another GLN must fail. This is the platform\'s most important authorization rule and needs explicit coverage here.',
  '**Role authorization** — a role not permitted this operation must be refused even with a valid key and a well-formed body.',
  '**Idempotency** — re-using an `instanceIdentifier` must not create a second event.',
  '**JSON and XML are separate code paths.** The EPCIS 1.2 SOAP/XML variant needs its own coverage, including an XXE attempt.',
  '**Identifier validation** — malformed SGTIN/SSCC/SGLN URNs, GLNs failing the GS1 check digit, and non-ISO-8601 timestamps must all be rejected.',
]

const FEATURES = {
  'api-authentication': {
    featureId: 'EPTTS_API_01',
    name: 'Authentication',
    priority: 'P1',
    tcs: 13,
    endpoint: '`POST /auth`',
    nav: 'registry-service (`:8445`) — **to be confirmed**, see Notes',
    purpose:
      'Exchanges a role API key for a bearer token. Every other endpoint in this module depends on it, so a break here fails the entire suite. The API key identifies *which trade partner* the caller is acting as, making this both the authentication and the tenant-selection boundary.',
    request: {
      lang: 'http',
      body: [
        'POST /auth',
        'apikey: <role API key>',
        '',
        '-> 200 { "access_token": "<jwt>" }',
      ].join('\n'),
    },
    happy: [
      'Send `POST /auth` with a valid role `apikey` header.',
      'Receive `200` and an `access_token` in the body.',
      'Use that token as `Authorization: Bearer <token>` on a subsequent request and confirm it is accepted.',
    ],
    edge: [
      '**The username/password flow in the source spreadsheet no longer exists.** `POST /auth` returns `401` for an empty body, i.e. it rejects on the `apikey` header before reading the body. `TC_AUTH_004`–`TC_AUTH_013` were written against username/password and are all `Blocked/Skipped` with the note *"In new version, it depends only on apikey."*',
      'Missing `apikey` header entirely.',
      'Malformed / random `apikey` value.',
      'Revoked or rotated `apikey`.',
      'Expired `apikey`.',
      'A key belonging to a different tenant — must not grant access to this tenant\'s data.',
      'Token expiry: a token past its lifetime must be refused by downstream endpoints with `401`, not silently accepted.',
      'Token scope: a manufacturer token must not authorize pharmacy-only operations.',
    ],
    notes: [
      'Two candidate auth URLs were both reachable (`401`) during recon: `:8445/registry-service/api/v1/auth` (the URL supplied for production) and `:8444/masar-service/api/v1/auth` (the Postman collection\'s). **Which is canonical must be confirmed live before the specs are finalised.**',
      'The 9 blocked cases need re-authoring around apikey-only semantics. Their IDs are retained so the spreadsheet still maps 1:1.',
    ],
  },

  'api-commission': {
    featureId: 'EPTTS_API_02',
    name: 'Commissioning',
    priority: 'P1',
    tcs: 41,
    role: 'Manufacturer',
    purpose:
      'Brings serial numbers into existence as real packs — the origin of every traceability chain. Only a manufacturer may commission, and only for GTINs registered under its own GS1 Company Prefix. Lot number and expiry are attached here via `ilmd` and cannot be supplied later, which makes this the one event where master data and serialization meet.',
    event: { type: 'ObjectEvent', action: 'ADD', bizStep: 'commissioning', disposition: 'active' },
    extra: '`ilmd`: `cbvmda:lotNumber`, `cbvmda:itemExpirationDate`',
    epc: 'epcList: the new SGTINs',
    happyNote: 'Final state: each SGTIN becomes **Commissioned**.',
    edge: [
      'Commissioning an already-commissioned SGTIN. **`TC_COMM_003` marks this *Positive* (status stays `Commissioned`) and a reviewer flagged it as wrong — the system should reject it. Open question for the PO.**',
      'A GTIN not registered under the manufacturer\'s GCP.',
      'An SGTIN whose company prefix does not match the acting GLN.',
      'Expiry date in the past; malformed expiry; missing lot number.',
      'A `sender`, `readPoint`, or `bizLocation` identifier belonging to a different GLN. **`TC_COMM_041` and `TC_COMM_042` are recorded `Fail`: the platform currently accepts a foreign `readPoint`/`bizLocation`.**',
      'Duplicate SGTINs inside one `epcList`.',
      'Very large `epcList` (batch limits).',
    ],
  },

  'api-packing': {
    featureId: 'EPTTS_API_03',
    name: 'Packing (Aggregation)',
    priority: 'P2',
    tcs: 17,
    role: 'Manufacturer or Branch',
    purpose:
      'Aggregates commissioned SGTINs into an SSCC (case/pallet), so downstream events can move a whole container by one identifier. Aggregation is hierarchical and cascading: shipping an SSCC moves every child pack with it, which is why a wrong aggregation silently corrupts every later event.',
    event: { type: 'AggregationEvent', action: 'ADD', bizStep: 'packing', disposition: 'active' },
    extra: '`parentID`: the SSCC · `childEPCs`: the SGTINs being added',
    epc: 'parentID + childEPCs (not epcList)',
    happyNote: 'Final state: the SSCC contains the children; each child becomes **Packed**.',
    edge: [
      'Packing into an SSCC that already exists and is open (append) versus a brand-new SSCC (create).',
      'Packing an SGTIN that is not commissioned.',
      'Packing an SGTIN already packed in a *different* SSCC — double-parenting must be refused.',
      'Packing an SGTIN into an SSCC owned by another GLN.',
      'Empty `childEPCs`; `parentID` missing; `parentID` that is an SGTIN rather than an SSCC.',
      'Self-reference: `parentID` present in its own `childEPCs`.',
      'Nested aggregation (SSCC inside SSCC) — supported or rejected (TBD with PO).',
      'Packing into a sealed/shipped SSCC.',
    ],
  },

  'api-unpacking': {
    featureId: 'EPTTS_API_04',
    name: 'Unpacking (Disaggregation)',
    priority: 'P2',
    tcs: 11,
    role: 'Manufacturer or Branch',
    purpose:
      'Removes SGTINs from an SSCC, reverting them to standalone packs. The mirror of packing, distinguished only by `action: DELETE` and `bizStep: unpacking` — which makes it easy for an implementation to confuse the two, and worth asserting the direction of the state change explicitly.',
    event: { type: 'AggregationEvent', action: 'DELETE', bizStep: 'unpacking', disposition: 'active' },
    extra: '`parentID`: the SSCC · `childEPCs`: the SGTINs being removed',
    epc: 'parentID + childEPCs',
    happyNote: 'Final state: children are removed from the SSCC and revert to **Commissioned**.',
    edge: [
      'Unpacking a child that is not in the named SSCC.',
      'Unpacking every child — the SSCC becomes empty; confirm whether it is deleted or retained empty.',
      'Unpacking from an SSCC that does not exist.',
      'Unpacking from an SSCC currently **In transit** — must be refused.',
      'Unpacking from an SSCC owned by another GLN.',
      'Empty `childEPCs`.',
      'Unpacking the same child twice.',
    ],
  },

  'api-destruction': {
    featureId: 'EPTTS_API_05',
    name: 'Destruction',
    priority: 'P3',
    tcs: 29,
    role: 'Any holder of the pack',
    purpose:
      'Permanently decommissions packs as destroyed. **Irreversible** — a destroyed pack can never re-enter the supply chain, so the platform must both accept legitimate destruction and refuse it for packs the caller does not hold. Every test here writes an unrecoverable state.',
    event: { type: 'ObjectEvent', action: 'DELETE', bizStep: 'destroying', disposition: 'destroyed' },
    epc: 'epcList: the SGTINs / SSCCs to destroy',
    happyNote: 'Final state: each pack becomes **Destroyed**.',
    edge: [
      'Destroying an already-destroyed pack.',
      'Destroying a pack in transit, or one held by a different GLN.',
      'Destroying an SSCC — confirm whether children cascade to Destroyed.',
      'Destroying a non-existent SGTIN.',
      'Destroying a dispensed pack.',
      'Any operation on a destroyed pack afterwards (ship, dispense, return) must be refused — the strongest proof destruction actually took effect.',
      'Mixed `epcList` where some EPCs are valid and some are not: all-or-nothing, or partial (TBD with PO).',
    ],
  },

  'api-shipping': {
    featureId: 'EPTTS_API_06',
    name: 'Shipping',
    priority: 'P1',
    tcs: 44,
    role: 'Manufacturer, Branch, or Pharmacy (returns)',
    purpose:
      'Transfers custody: packs leave the sender and become **In transit** toward a destination GLN. The busiest feature in the module and the one with the richest request body — it is the only event carrying `sourceList`, `destinationList`, and a `bizTransactionList` invoice reference, so it has the largest mandatory-field surface.',
    event: { type: 'ObjectEvent', action: 'OBSERVE', bizStep: 'shipping', disposition: 'in_transit' },
    extra:
      '`sourceList`: `{ type: urn:epcglobal:cbv:sdt:owning_party, source: <sender SGLN> }` · ' +
      '`destinationList`: `{ type: ..., destination: <receiver SGLN> }` · ' +
      '`bizTransactionList`: `{ type: urn:epcglobal:cbv:btt:desadv, bizTransaction: <invoice ref> }`',
    epc: 'epcList: the SSCCs and/or SGTINs being shipped',
    happyNote: 'Final state: the SSCC and every contained pack become **In transit**.',
    edge: [
      'Routes: Manufacturer→Branch, Branch→Branch, Branch→Pharmacy. Each is a distinct authorization path.',
      'A destination GLN not registered as a trade partner.',
      'Shipping a pack already in transit, or already in another open shipment.',
      'Shipping a non-existent, destroyed, or dispensed pack.',
      'Mandatory-field matrix — `epcList`, `bizTransactionList`, invoice number, `sourceType`, `destinationType`, `eventTime`, `eventTimeZoneOffset`, `action`, `bizStep`, `disposition`, `readPoint`, `bizLocation`, SBDH sender/receiver, `instanceIdentifier`. Each empty or omitted in turn.',
      'Injection payloads in the invoice number.',
      'Shipping Cancel / Void (`bizStep: void_shipping`) reverses an in-transit shipment — covered in the collection, not yet in these 44 cases.',
    ],
    notes: [
      '**`TC_SHIP_025`–`TC_SHIP_044` were 20 entirely empty reserved ID slots in the source spreadsheet** (an ID and `Validity: Negative`, nothing else). They have been authored to continue the mandatory-field sequence the sheet began at `TC_SHIP_020`, plus format, ownership, role, idempotency, content-type, and injection negatives. See `## Notes & Known Defects` in the test-case file and `scripts/eptts-api-overrides.json`.',
      '8 of the 24 originally-authored cases are recorded `Fail` from staging.',
    ],
  },

  'api-receiving': {
    featureId: 'EPTTS_API_07',
    name: 'Receiving',
    priority: 'P1',
    tcs: 42,
    role: 'Branch or Pharmacy',
    purpose:
      'Accepts custody of an in-transit shipment: packs become **Received / In stock** at the receiver. The counterpart to shipping, and the point where discrepancies surface — a receiver claiming EPCs that were never shipped to it, or omitting some that were.',
    event: { type: 'ObjectEvent', action: 'OBSERVE', bizStep: 'receiving', disposition: 'in_progress' },
    extra: '`sourceList`: `{ type: urn:epcglobal:cbv:sdt:owning_party, source: <shipper SGLN> }`',
    epc: 'epcList: the EPCs from the shipment',
    happyNote: 'Final state: the SSCC and its packs move from **In transit** to **Received / In stock**.',
    edge: [
      'Partial receive — fewer EPCs than were shipped. Confirm whether the shipment stays open, and what the un-received packs\' state becomes.',
      'Over-receive — an EPC that was never shipped to this GLN.',
      'Receiving a shipment addressed to a *different* destination GLN. A core ownership case.',
      'Receiving the same shipment twice.',
      'Receiving a pack not in transit (still Commissioned, or already Received).',
      'Receiving after the shipment was voided.',
      'Empty `epcList`; missing `sourceList`.',
    ],
    notes: [
      '**`TS_RECV_001` is recorded `Fail` against `DW-878`** — receiving a complete shipment from the manufacturer. As the primary happy path of a P1 feature, this is the highest-value case to re-verify first against production.',
    ],
  },

  'api-return': {
    featureId: 'EPTTS_API_08',
    name: 'Return Shipping',
    priority: 'P2',
    tcs: 42,
    role: 'Branch or Pharmacy',
    purpose:
      'Sends stock back upstream: packs become **Returned** and travel toward the original shipper. Structurally shipping with `disposition: returned` plus a return reference, but the business rules differ — a return must trace back to the partner that originally supplied the pack, not to an arbitrary GLN.',
    event: { type: 'ObjectEvent', action: 'OBSERVE', bizStep: 'shipping', disposition: 'returned' },
    extra: '`sourceList`, `destinationList`, and a return reference in `bizTransactionList` (e.g. `RET-1001`)',
    epc: 'epcList: the EPCs being returned',
    happyNote: 'Final state: the packs become **Returned** / in transit to the upstream partner.',
    edge: [
      'Returning to a GLN that did not originally ship the pack.',
      'Returning a pack not in stock at the returner.',
      'Returning an already-returned or already-dispensed pack.',
      'Duplicate return reference; empty return reference.',
      'Return Cancel while the return is open (`bizStep` per the collection\'s Return Cancel request).',
      'Returning a destroyed pack.',
      'Partial return of an SSCC — some children only.',
    ],
  },

  'api-return-receiving': {
    featureId: 'EPTTS_API_09',
    name: 'Return Receiving',
    priority: 'P2',
    tcs: 40,
    role: 'Manufacturer or Branch',
    purpose:
      'Closes the reverse-logistics loop: the upstream partner accepts returned stock and the packs become **Available** again. The only transition that moves packs *out of* a terminal-looking state back into sellable inventory, so it is the one place where a bug can silently resurrect stock that should not be re-sold.',
    event: { type: 'ObjectEvent', action: 'OBSERVE', bizStep: 'receiving', disposition: 'returned' },
    extra: '`sourceList` (the returner) and the return reference in `bizTransactionList`',
    epc: 'epcList: the returned EPCs',
    happyNote: 'Final state: the packs move from **Returned** to **Available** at the receiver.',
    edge: [
      'Receiving a return against a closed or non-existent return reference.',
      'Receiving a return from a GLN that never returned anything.',
      'Receiving EPCs not part of the named return reference.',
      'Receiving the same return twice.',
      'Partial return receiving — fewer EPCs than were returned.',
      'Receiving a return the returner subsequently cancelled.',
      'Whether a returned-and-received pack may be shipped again — the business-critical question this feature ultimately answers.',
    ],
  },

  'api-dispensing': {
    featureId: 'EPTTS_API_10',
    name: 'Dispensing',
    priority: 'P1',
    tcs: 33,
    role: 'Pharmacy (or POS Integrator acting on its behalf)',
    endpoint: '`POST /Dispensation`',
    purpose:
      'The terminal event of the supply chain: a pharmacy dispenses a pack to a patient and it leaves circulation as **Dispensed**. The source spreadsheet and the vendor collection both describe this endpoint as **synchronous (`200`)**. Verified live, that is wrong: it returns **`202` + `I001`** and must be polled through `MsgStatusQuery` like every other write. A test asserting `200` here fails against the real platform.',
    event: { type: 'ObjectEvent', action: 'OBSERVE', bizStep: 'retail_selling', disposition: 'retail_sold' },
    epc: 'epcList: the SGTINs being dispensed',
    happyNote: 'Final state: each pack becomes **Dispensed** and leaves pharmacy inventory.',
    edge: [
      'Dispensing a pack not in this pharmacy\'s inventory.',
      'Dispensing an already-dispensed pack.',
      'Dispensing a destroyed, recalled, or expired pack.',
      'Dispensing a pack still in transit.',
      'Dispensing an SSCC rather than an SGTIN.',
      'Dispense Cancel — reverses a dispensation; confirm the pack returns to **In stock** and can be dispensed again.',
      'A POS Integrator dispensing with a mismatched `actingOnBehalfOfGln`.',
      'Empty `epcList`; duplicate SGTINs in one request.',
    ],
  },

  'api-partial-dispensing': {
    featureId: 'EPTTS_API_11',
    name: 'Partial Dispensing',
    priority: 'P2',
    tcs: 36,
    role: 'Pharmacy (or POS Integrator acting on its behalf)',
    endpoint: '`POST /Dispensation`',
    purpose:
      'Dispenses a quantity out of a multi-unit pack, leaving a remainder. The pack sits in **Partially Dispensed** across several requests until exhausted, then becomes **Dispensed**. The only quantity-bearing event in the module, which makes arithmetic correctness — and refusing to over-dispense — the whole point of this feature.',
    event: { type: 'ObjectEvent', action: 'OBSERVE', bizStep: 'retail_selling', disposition: 'retail_sold' },
    extra: '`quantity`: the number of units dispensed',
    epc: 'epcList: the SGTIN being partially dispensed',
    happyNote:
      'Final state: the quantity is deducted, the pack becomes **Partially Dispensed**, and once the remainder reaches zero it becomes **Dispensed**.',
    edge: [
      'Sequential partial dispenses summing exactly to the pack total — the remainder must decrease correctly at each step and the pack must flip to **Dispensed** on the last one.',
      'A quantity exceeding the remaining amount — must be refused, not clamped.',
      'Quantity of zero; negative quantity; fractional quantity; non-numeric quantity.',
      'Quantity omitted entirely — does it fall back to a full dispense? (TBD with PO.)',
      'Quantity greater than the pack\'s original total.',
      'Partially dispensing a pack already fully dispensed.',
      'Concurrent partial dispenses of the same SGTIN — the remainder must not go negative through a race.',
      'Cancelling one partial dispense out of several: which quantity is restored.',
    ],
  },
}

// ─── document skeleton ───────────────────────────────────────────────────────

function eventBlock(f) {
  const e = f.event
  if (!e) return null
  const lines = [
    '{',
    `  "type": "${e.type}",`,
    '  "eventTime": "<ISO 8601 with offset>",',
    '  "eventTimeZoneOffset": "<+03:00>",',
    `  "action": "${e.action}",`,
    `  "bizStep": "${e.bizStep}",`,
    `  "disposition": "${e.disposition}",`,
  ]
  if (e.type === 'AggregationEvent') {
    lines.push('  "parentID": "<SSCC URN>",', '  "childEPCs": ["<SGTIN URN>", "..."],')
  } else {
    lines.push('  "epcList": ["<EPC URN>", "..."],')
  }
  lines.push('  "readPoint":   { "id": "<acting SGLN>" },', '  "bizLocation": { "id": "<acting SGLN>" }')
  lines.push('}')
  return lines.join('\n')
}

function render(slug, f) {
  const endpoint = f.endpoint || '`POST /scp/SendEPCIS`'
  const out = []

  out.push(`# ${f.name} — API Workflow`, '')
  out.push('## Feature Details', '')
  out.push('| Field | Value |', '|-------|-------|')
  out.push(`| **Feature Name** | ${f.name} |`)
  out.push(`| **Slug** | \`${slug}\` |`)
  out.push(`| **Feature ID** | \`${f.featureId}\` |`)
  out.push('| **Module** | EPTTS APIs |')
  out.push(`| **Endpoint** | ${endpoint} |`)
  if (f.role) out.push(`| **Acting role** | ${f.role} |`)
  out.push(`| **Response mode** | ${f.sync ? 'Synchronous — `200`, no polling' : 'Asynchronous — `202` then `MsgStatusQuery`'} |`)
  out.push(`| **Priority** | ${f.priority} |`)
  out.push(`| **Test cases** | ${f.tcs} |`)
  out.push('')

  out.push('## Business Purpose', '', f.purpose, '')

  out.push('## Request Contract', '')
  if (f.request) {
    out.push('```' + f.request.lang, f.request.body, '```', '')
  } else {
    out.push(
      `Standard EPCIS envelope (see the module overview for the full \`@context\` / \`sbdh\` wrapper)`,
      `posted to ${endpoint} with headers \`apikey\`, \`Authorization: Bearer <token>\`, and`,
      '`Content-Type: application/json` (or `application/xml` for the EPCIS 1.2 SOAP variant).',
      '',
      'The `epcisBody.eventList` entry for this feature:',
      '',
      '```json',
      eventBlock(f),
      '```',
      ''
    )
    if (f.extra) out.push(`**Distinctive fields** — ${f.extra}`, '')
    if (f.epc) out.push(`**EPC carrier** — ${f.epc}`, '')
  }

  out.push('## Happy Path', '')
  const steps = f.happy || (f.sync
    ? [
        'Authenticate: `POST /auth` with the role `apikey` header; capture `access_token`.',
        `Build the EPCIS document with the acting GLN as SBDH sender and a fresh UUID as \`instanceIdentifier\`.`,
        `Submit: ${endpoint} with \`apikey\` + \`Authorization: Bearer <token>\`.`,
        'Receive **`200`** — this endpoint is synchronous; there is no `MsgStatusQuery` step.',
        'Confirm the resulting pack state with `POST /VerifyProduct`.',
      ]
    : ASYNC_HAPPY)
  steps.forEach((s, i) => out.push(`${i + 1}. ${s}`))
  if (f.happyNote) out.push('', f.happyNote)
  out.push('')

  out.push('## Edge Cases & Validation Rules', '')
  out.push('### Specific to this feature', '')
  for (const e of f.edge) out.push(`- ${e}`)
  out.push('')
  out.push('### Applies to every event feature', '')
  for (const e of COMMON_EDGE) out.push(`- ${e}`)
  out.push('')

  out.push('## Notes', '')
  const notes = f.notes || []
  notes.push(
    'Test data in the extracted cases still carries **staging-era GLNs** that do not match the production devsim tenant. See the module overview\'s re-mapping table.',
    'Executing this feature writes to **production**. Generated EPCs use run-scoped unique serials so repeated runs cannot collide.',
    'Recorded statuses in the test-case table are historical (from staging) and seed the Execution tab; nothing here has been executed against production yet.'
  )
  for (const n of notes) out.push(`- ${n}`)
  out.push('')

  return out.join('\n')
}

// ─── main ────────────────────────────────────────────────────────────────────

let written = 0
for (const [slug, f] of Object.entries(FEATURES)) {
  const dir = path.join(FEATURES_DIR, slug)
  if (!fs.existsSync(dir)) {
    console.error(`!! missing feature dir ${slug} — run scripts/eptts-api-testcases.js --write first`)
    process.exitCode = 1
    continue
  }
  const md = render(slug, f)
  if (WRITE) fs.writeFileSync(path.join(dir, 'workflow.md'), md, 'utf8')
  written++
  console.log(`  ${slug.padEnd(25)} ${String(md.split('\n').length).padStart(4)} lines  (${f.tcs} TCs, ${f.priority})`)
}
console.log(`\n${WRITE ? 'wrote' : 'would write'} ${written} workflow.md files`)
if (!WRITE) console.log('(pass --write to apply)')
