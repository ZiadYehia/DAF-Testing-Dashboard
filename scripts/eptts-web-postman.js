#!/usr/bin/env node
/**
 * Generate a Postman collection + environment for the EPTTS / Masar B2B API.
 *
 * Usage:
 *   node scripts/eptts-web-postman.js            # dry run (prints a summary)
 *   node scripts/eptts-web-postman.js --write
 *
 * Outputs (schema v2.1.0):
 *   automation-hub/exports/eptts-apis.postman_collection.json
 *   automation-hub/exports/eptts-apis.postman_environment.json
 *
 * Built from the contract VERIFIED against production on 2026-08-31 — see
 * data/eptts-web/modules/eptts-apis/knowledge/verified-live-contract.md. It differs
 * from the vendor's "Masar B2B API — Role Scenarios" collection in three ways that
 * matter, all of which made that collection wrong against this build:
 *
 *   1. /auth lives on :8445/registry-service/api/v1, NOT :8444/masar-service
 *      (which is a 404).
 *   2. `apikey` is sent ONLY to /auth. Every other request authenticates with
 *      `Authorization: Bearer` alone.
 *   3. GLNs and GTINs are the devsim tenant's real ones, not staging placeholders.
 *
 * Secrets stay as {{variables}} in the environment file — never literals, because
 * exports/ is committed.
 */
const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')
const OUT_DIR = path.join(REPO, 'automation-hub', 'exports')
const WRITE = process.argv.includes('--write')

// ─── the devsim tenant, as confirmed live ────────────────────────────────────

const VARS = {
  registryBase: 'https://192.168.225.195:8445/registry-service/api/v1',
  masarBase: 'https://192.168.225.195:8444/masar-service/api/v1',
  mfgGln: '8435308300002',
  branchGln: '0085412000008',
  pharmacyGln: '1234567890128',
  mfgPrefix: '84353083',
  // GTIN 08435308354487, GCP length 8 -> sgtin prefix 84353083.05448
  mfgSgtinPrefix: 'urn:epc:id:sgtin:84353083.05448',
  mfgSgln: 'urn:epc:id:sgln:84353083.0000.0',
  branchSgln: 'urn:epc:id:sgln:0085412.00000.0',
  pharmacySgln: 'urn:epc:id:sgln:1234567.89012.0',
  gtin: '08435308354487',
  lot: 'LOT-ZTG-001',
  expiry: '2030-12-31',
}

const SECRET_VARS = ['mfgApiKey', 'branchApiKey', 'pharmacyApiKey']

// ─── helpers ─────────────────────────────────────────────────────────────────

/** A pre-request script that stamps fresh timestamps + a unique instanceIdentifier. */
const PRE_REQUEST = [
  '// Fresh values per send: the platform rejects a reused instanceIdentifier and',
  '// requires an ISO 8601 timestamp WITH an offset.',
  'const d = new Date();',
  'const p = (n) => String(n).padStart(2, "0");',
  'const iso = `${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())}` +',
  '  `T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}+03:00`;',
  'pm.collectionVariables.set("eventTime", iso);',
  'const uniq = Date.now().toString(36).toUpperCase();',
  'pm.collectionVariables.set("instanceId", "pm-" + uniq);',
  'pm.collectionVariables.set("serial", "PM" + uniq);',
  'pm.collectionVariables.set("ssccSerial", String(Date.now()).slice(-9).padStart(9, "0"));',
].join('\n')

function authRequest(role, keyVar, tokenVar) {
  return {
    name: `Auth — ${role}`,
    event: [
      {
        listen: 'test',
        script: {
          type: 'text/javascript',
          exec: [
            'pm.test("200 OK", () => pm.response.to.have.status(200));',
            'const j = pm.response.json();',
            'pm.test("access_token returned", () => pm.expect(j.access_token).to.be.a("string"));',
            'pm.test("token_type is Bearer", () => pm.expect(j.token_type).to.eql("Bearer"));',
            'pm.test("expires_in is 900s", () => pm.expect(j.expires_in).to.eql(900));',
            `pm.collectionVariables.set("${tokenVar}", j.access_token);`,
            '// Claims are scoped to the acting entity — assert the binding.',
            'const c = JSON.parse(atob(j.access_token.split(".")[1]));',
            'pm.test("token is a b2b partner token", () => pm.expect(c.principalType).to.eql("b2b_partner"));',
            'console.log("role=" + c.role + " gln=" + c.entityGln);',
          ],
        },
      },
    ],
    request: {
      method: 'POST',
      // apikey belongs ONLY here. Verified: every other endpoint ignores it.
      header: [{ key: 'apikey', value: `{{${keyVar}}}`, type: 'text' }],
      url: { raw: '{{registryBase}}/auth', host: ['{{registryBase}}'], path: ['auth'] },
      description:
        'Exchanges a 64-char B2B API key for a 15-minute bearer token.\n\n' +
        'Verified live: a valid `apikey` header is mandatory. The body is optional and ' +
        'conditionally validated: the legacy username/password path engages only when BOTH ' +
        'fields are present and non-empty (a wrong pair returns 401), and is skipped when ' +
        'either is empty, null, or absent. No credential pair can substitute for a valid key.\n\n' +
        'Note this is on :8445/registry-service. The vendor collection points at ' +
        ':8444/masar-service/api/v1/auth, which returns 404 on this build.',
    },
  }
}

/** A masar-service request authenticated with Bearer only. */
function masarRequest({ name, method = 'POST', endpoint, body, tokenVar, tests, description, query }) {
  const rawUrl = `{{masarBase}}/${endpoint}` + (query ? `?${query}` : '')
  const req = {
    name,
    event: [
      { listen: 'prerequest', script: { type: 'text/javascript', exec: PRE_REQUEST.split('\n') } },
      { listen: 'test', script: { type: 'text/javascript', exec: tests } },
    ],
    request: {
      method,
      header: [
        // No apikey: verified redundant once a token is held.
        { key: 'Authorization', value: `Bearer {{${tokenVar}}}`, type: 'text' },
        ...(body ? [{ key: 'Content-Type', value: 'application/json', type: 'text' }] : []),
      ],
      url: {
        raw: rawUrl,
        host: ['{{masarBase}}'],
        path: endpoint.split('/'),
        ...(query
          ? { query: query.split('&').map((kv) => ({ key: kv.split('=')[0], value: kv.split('=')[1] })) }
          : {}),
      },
      ...(description ? { description } : {}),
    },
  }
  if (body) req.request.body = { mode: 'raw', raw: JSON.stringify(body, null, 2), options: { raw: { language: 'json' } } }
  return req
}

/** The EPCIS envelope, as a Postman-templated object. */
function envelope(senderVar, receiverVar, events) {
  return {
    '@context': ['https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonld'],
    type: 'EPCISDocument',
    schemaVersion: '2.0',
    creationDate: '{{eventTime}}',
    sbdh: {
      headerVersion: '1.3',
      sender: { identifier: `{{${senderVar}}}` },
      receiver: { identifier: `{{${receiverVar}}}` },
      documentIdentification: {
        standard: 'EPCGlobal',
        typeVersion: '1.0',
        instanceIdentifier: '{{instanceId}}',
        type: 'Events',
        creationDateAndTime: '{{eventTime}}',
      },
    },
    epcisBody: { eventList: events },
  }
}

const baseEvent = (readPointVar) => ({
  eventTime: '{{eventTime}}',
  eventTimeZoneOffset: '+03:00',
  readPoint: { id: `{{${readPointVar}}}` },
  bizLocation: { id: `{{${readPointVar}}}` },
})

/** Standard assertions for the 202 -> MsgStatusQuery -> SUCCESS pattern. */
const ASYNC_TESTS = [
  'pm.test("202 Accepted (queued, NOT applied)", () => pm.response.to.have.status(202));',
  'const j = pm.response.json();',
  'pm.test("accept envelope carries I001", () => pm.expect(j.status.code).to.eql("I001"));',
  'pm.collectionVariables.set("lastInstanceId", pm.collectionVariables.get("instanceId"));',
  '',
  '// A 202 alone proves nothing. Run "Utility / MsgStatusQuery" next and expect',
  '// SUCCESS, then assert the resulting pack state with VerifyProduct.',
  'console.log("poll MsgStatusQuery with instanceIdentifier=" + pm.collectionVariables.get("instanceId"));',
]

const REJECT_TESTS = (expectedCode, what) => [
  `pm.test("rejected synchronously (400)", () => pm.response.to.have.status(400));`,
  'const j = pm.response.json();',
  `pm.test("${what}", () => pm.expect(JSON.stringify(j)).to.include("${expectedCode}"));`,
  '// Synchronous rejection: nothing is queued, so MsgStatusQuery has no record.',
]

// ─── folders ─────────────────────────────────────────────────────────────────

const SGTIN = '{{mfgSgtinPrefix}}.{{serial}}'
const SSCC = 'urn:epc:id:sscc:{{mfgPrefix}}.{{ssccSerial}}'

function build() {
  const folders = []

  // 0. Auth
  folders.push({
    name: '0. Auth',
    description:
      'Run these first. Each stores its bearer token in a collection variable used by ' +
      'every later request. Tokens last 900 s — re-run when they expire.',
    item: [
      authRequest('Manufacturer', 'mfgApiKey', 'mfgToken'),
      authRequest('Branch (distributor role)', 'branchApiKey', 'branchToken'),
      authRequest('Pharmacy', 'pharmacyApiKey', 'pharmacyToken'),
      {
        name: 'Auth — missing apikey (negative)',
        event: [{ listen: 'test', script: { type: 'text/javascript', exec: [
          'pm.test("401 without an apikey header", () => pm.response.to.have.status(401));',
        ] } }],
        request: {
          method: 'POST',
          header: [],
          url: { raw: '{{registryBase}}/auth', host: ['{{registryBase}}'], path: ['auth'] },
          description: 'The endpoint rejects on the header before reading any body.',
        },
      },
      {
        name: 'Auth — invalid apikey (negative)',
        event: [{ listen: 'test', script: { type: 'text/javascript', exec: [
          'pm.test("401 for a bogus apikey", () => pm.response.to.have.status(401));',
        ] } }],
        request: {
          method: 'POST',
          header: [{ key: 'apikey', value: 'not-a-real-key-000000000000000000000000000000000000000000000000', type: 'text' }],
          url: { raw: '{{registryBase}}/auth', host: ['{{registryBase}}'], path: ['auth'] },
        },
      },
    ],
  })

  // 1. Commissioning
  folders.push({
    name: '1. Commissioning (EPTTS_API_02)',
    description: 'Manufacturer only. Brings SGTINs into existence. Requires a GTIN under the acting manufacturer\'s own GCP.',
    item: [
      masarRequest({
        name: '1.01 Commission a single pack (TC_COMM_001)',
        endpoint: 'scp/SendEPCIS',
        tokenVar: 'mfgToken',
        tests: ASYNC_TESTS,
        description: 'Happy path. Final state: the SGTIN becomes Commissioned.',
        body: envelope('mfgGln', 'mfgGln', [{
          type: 'ObjectEvent', ...baseEvent('mfgSgln'),
          action: 'ADD', bizStep: 'commissioning', disposition: 'active',
          epcList: [SGTIN],
          ilmd: { 'cbvmda:lotNumber': '{{lot}}', 'cbvmda:itemExpirationDate': '{{expiry}}' },
        }]),
      }),
      masarRequest({
        name: '1.02 Commission multiple packs (TC_COMM_002)',
        endpoint: 'scp/SendEPCIS',
        tokenVar: 'mfgToken',
        tests: ASYNC_TESTS,
        body: envelope('mfgGln', 'mfgGln', [{
          type: 'ObjectEvent', ...baseEvent('mfgSgln'),
          action: 'ADD', bizStep: 'commissioning', disposition: 'active',
          epcList: [`${SGTIN}A`, `${SGTIN}B`, `${SGTIN}C`],
          ilmd: { 'cbvmda:lotNumber': '{{lot}}', 'cbvmda:itemExpirationDate': '{{expiry}}' },
        }]),
      }),
      masarRequest({
        name: '1.90 No SBDH (negative — E003)',
        endpoint: 'scp/SendEPCIS',
        tokenVar: 'mfgToken',
        tests: REJECT_TESTS('E003', 'error code E003 / Missing SBDH'),
        description: 'Verified: /scp/SendEPCIS rejects a document with no SBDH synchronously with code E003.',
        body: {},
      }),
      masarRequest({
        name: '1.91 Empty eventList (PROBABLE DEFECT — returns 202)',
        endpoint: 'scp/SendEPCIS',
        tokenVar: 'mfgToken',
        tests: [
          '// Verified live: an envelope with ZERO events is ACCEPTED (202) rather than',
          '// rejected. Recorded as a probable defect; this test asserts the real',
          '// behaviour so a future fix shows up here as a failure.',
          'pm.test("currently accepted (202) — expected 400", () => pm.response.to.have.status(202));',
        ],
        body: envelope('mfgGln', 'mfgGln', []),
      }),
    ],
  })

  // 2. Packing / Unpacking
  folders.push({
    name: '2. Packing & Unpacking (EPTTS_API_03 / 04)',
    description: 'AggregationEvent. action ADD packs, DELETE unpacks. Run commissioning first.',
    item: [
      masarRequest({
        name: '2.01 Pack SGTINs into an SSCC (TS_PACK_001)',
        endpoint: 'scp/SendEPCIS', tokenVar: 'mfgToken', tests: ASYNC_TESTS,
        body: envelope('mfgGln', 'mfgGln', [{
          type: 'AggregationEvent', ...baseEvent('mfgSgln'),
          action: 'ADD', bizStep: 'packing', disposition: 'active',
          parentID: SSCC, childEPCs: [SGTIN],
        }]),
      }),
      masarRequest({
        name: '2.02 Unpack from an SSCC (TS_UNPK_001)',
        endpoint: 'scp/SendEPCIS', tokenVar: 'mfgToken', tests: ASYNC_TESTS,
        description: 'Mirror of packing. Final state: the child reverts to Commissioned.',
        body: envelope('mfgGln', 'mfgGln', [{
          type: 'AggregationEvent', ...baseEvent('mfgSgln'),
          action: 'DELETE', bizStep: 'unpacking', disposition: 'active',
          parentID: SSCC, childEPCs: [SGTIN],
        }]),
      }),
    ],
  })

  // 3. Shipping / Receiving
  folders.push({
    name: '3. Shipping & Receiving (EPTTS_API_06 / 07)',
    description:
      'Custody transfer. Shipping carries sourceList, destinationList and an invoice ' +
      'reference; receiving carries sourceList. Ship as manufacturer, receive as branch.',
    item: [
      masarRequest({
        name: '3.01 Ship manufacturer -> branch (TC_SHIP_001)',
        endpoint: 'scp/SendEPCIS', tokenVar: 'mfgToken', tests: ASYNC_TESTS,
        body: envelope('mfgGln', 'branchGln', [{
          type: 'ObjectEvent', ...baseEvent('mfgSgln'),
          action: 'OBSERVE', bizStep: 'shipping', disposition: 'in_transit',
          epcList: [SSCC],
          sourceList: [{ type: 'urn:epcglobal:cbv:sdt:owning_party', source: '{{mfgSgln}}' }],
          destinationList: [{ type: 'urn:epcglobal:cbv:sdt:owning_party', destination: '{{branchSgln}}' }],
          bizTransactionList: [{ type: 'urn:epcglobal:cbv:btt:desadv', bizTransaction: 'INV-ZTG-{{serial}}' }],
        }]),
      }),
      masarRequest({
        name: '3.02 Receive at branch (TS_RECV_001 — known fail DW-878)',
        endpoint: 'scp/SendEPCIS', tokenVar: 'branchToken', tests: ASYNC_TESTS,
        description:
          'The primary happy path of a P1 feature, recorded as FAILING against DW-878 in ' +
          'the source spreadsheet. Highest-value case to re-verify.',
        body: envelope('branchGln', 'mfgGln', [{
          type: 'ObjectEvent', ...baseEvent('branchSgln'),
          action: 'OBSERVE', bizStep: 'receiving', disposition: 'in_progress',
          epcList: [SSCC],
          sourceList: [{ type: 'urn:epcglobal:cbv:sdt:owning_party', source: '{{mfgSgln}}' }],
        }]),
      }),
      masarRequest({
        name: '3.90 Ship an EPC owned by another GLN (negative)',
        endpoint: 'scp/SendEPCIS', tokenVar: 'mfgToken',
        tests: [
          'pm.test("accepted for processing", () => pm.response.to.have.status(202));',
          '// GLN-ownership failures are ASYNCHRONOUS: the 202 is expected, and the',
          '// rejection only shows up in MsgStatusQuery as FAILED. Poll it next.',
          'pm.collectionVariables.set("lastInstanceId", pm.collectionVariables.get("instanceId"));',
        ],
        body: envelope('mfgGln', 'branchGln', [{
          type: 'ObjectEvent', ...baseEvent('mfgSgln'),
          action: 'OBSERVE', bizStep: 'shipping', disposition: 'in_transit',
          epcList: ['urn:epc:id:sscc:0085412.00099000099'],
          sourceList: [{ type: 'urn:epcglobal:cbv:sdt:owning_party', source: '{{mfgSgln}}' }],
          destinationList: [{ type: 'urn:epcglobal:cbv:sdt:owning_party', destination: '{{branchSgln}}' }],
          bizTransactionList: [{ type: 'urn:epcglobal:cbv:btt:desadv', bizTransaction: 'INV-ZTG-OWN' }],
        }]),
      }),
    ],
  })

  // 4. Returns
  folders.push({
    name: '4. Returns (EPTTS_API_08 / 09)',
    description: 'Reverse logistics: return-ship upstream (disposition returned), then return-receive.',
    item: [
      masarRequest({
        name: '4.01 Return-ship branch -> manufacturer (TS_RTN_001)',
        endpoint: 'scp/SendEPCIS', tokenVar: 'branchToken', tests: ASYNC_TESTS,
        body: envelope('branchGln', 'mfgGln', [{
          type: 'ObjectEvent', ...baseEvent('branchSgln'),
          action: 'OBSERVE', bizStep: 'shipping', disposition: 'returned',
          epcList: [SSCC],
          sourceList: [{ type: 'urn:epcglobal:cbv:sdt:owning_party', source: '{{branchSgln}}' }],
          destinationList: [{ type: 'urn:epcglobal:cbv:sdt:owning_party', destination: '{{mfgSgln}}' }],
          bizTransactionList: [{ type: 'urn:epcglobal:cbv:btt:desadv', bizTransaction: 'RET-ZTG-{{serial}}' }],
        }]),
      }),
      masarRequest({
        name: '4.02 Return-receive at manufacturer (TS_RTRV_001)',
        endpoint: 'scp/SendEPCIS', tokenVar: 'mfgToken', tests: ASYNC_TESTS,
        description: 'Closes the loop: the packs become Available again at the manufacturer.',
        body: envelope('mfgGln', 'branchGln', [{
          type: 'ObjectEvent', ...baseEvent('mfgSgln'),
          action: 'OBSERVE', bizStep: 'receiving', disposition: 'returned',
          epcList: [SSCC],
          sourceList: [{ type: 'urn:epcglobal:cbv:sdt:owning_party', source: '{{branchSgln}}' }],
          bizTransactionList: [{ type: 'urn:epcglobal:cbv:btt:desadv', bizTransaction: 'RET-ZTG-{{serial}}' }],
        }]),
      }),
    ],
  })

  // 5. Dispensing
  folders.push({
    name: '5. Dispensing (EPTTS_API_10 / 11)',
    description:
      'POST /Dispensation — acknowledges with 200 (not 202 like /scp/SendEPCIS), but it is ' +
      'STILL ASYNCHRONOUS: the 200 means queued, not dispensed. Always follow with ' +
      '7.01 MsgStatusQuery. Pharmacy or branch only: a manufacturer token gets 403.',
    item: [
      masarRequest({
        name: '5.01 Dispense a full pack (TC_DISP_001)',
        endpoint: 'Dispensation', tokenVar: 'pharmacyToken',
        tests: [
          'pm.test("200 — queued, NOT dispensed", () => pm.response.to.have.status(200));',
          'pm.collectionVariables.set("lastInstanceId", pm.collectionVariables.get("instanceId"));',
          '// The 200 proves only that the request was accepted. Run 7.01 MsgStatusQuery next',
          '// and expect messagestatus to start with "S". A failed dispense also answers 200 here.',
          'console.log("poll MsgStatusQuery with instanceIdentifier=" + pm.collectionVariables.get("instanceId"));',
        ],
        body: envelope('pharmacyGln', 'branchGln', [{
          type: 'ObjectEvent', ...baseEvent('pharmacySgln'),
          action: 'OBSERVE', bizStep: 'retail_selling', disposition: 'retail_sold',
          epcList: [SGTIN],
        }]),
      }),
      masarRequest({
        name: '5.02 Partial dispense, quantity 5 (TC_PDISP_001)',
        endpoint: 'Dispensation', tokenVar: 'pharmacyToken',
        tests: [
          'pm.test("200 — queued, NOT dispensed", () => pm.response.to.have.status(200));',
          'pm.collectionVariables.set("lastInstanceId", pm.collectionVariables.get("instanceId"));',
          '// Poll 7.01 MsgStatusQuery, then check the remainder with 7.02 VerifyProduct.',
          '// NOTE: no product on the devsim tenant has a partial dispense type, so this',
          '// request cannot currently succeed there — see the partial-dispensing bug.',
        ],
        body: envelope('pharmacyGln', 'branchGln', [{
          type: 'ObjectEvent', ...baseEvent('pharmacySgln'),
          action: 'OBSERVE', bizStep: 'retail_selling', disposition: 'retail_sold',
          epcList: [SGTIN], quantity: 5,
        }]),
      }),
      masarRequest({
        name: '5.90 Manufacturer attempts to dispense (negative — 403)',
        endpoint: 'Dispensation', tokenVar: 'mfgToken',
        tests: [
          'pm.test("403 role denied", () => pm.response.to.have.status(403));',
          'pm.test("denial names the permitted roles", () =>',
          '  pm.expect(pm.response.json().message).to.include("available to"));',
        ],
        description: 'Verified: role enforcement rejects a manufacturer here before body validation.',
        body: envelope('mfgGln', 'mfgGln', [{
          type: 'ObjectEvent', ...baseEvent('mfgSgln'),
          action: 'OBSERVE', bizStep: 'retail_selling', disposition: 'retail_sold',
          epcList: [SGTIN],
        }]),
      }),
    ],
  })

  // 6. Destruction
  folders.push({
    name: '6. Destruction (EPTTS_API_05)',
    description: 'IRREVERSIBLE. A destroyed pack can never re-enter the supply chain.',
    item: [
      masarRequest({
        name: '6.01 Destroy a pack (TC_DEST_001)',
        endpoint: 'scp/SendEPCIS', tokenVar: 'mfgToken', tests: ASYNC_TESTS,
        body: envelope('mfgGln', 'mfgGln', [{
          type: 'ObjectEvent', ...baseEvent('mfgSgln'),
          action: 'DELETE', bizStep: 'destroying', disposition: 'destroyed',
          epcList: [SGTIN],
        }]),
      }),
    ],
  })

  // 7. Utility / queries
  folders.push({
    name: '7. Utility & Queries',
    description: 'Reads and the polling endpoint. MsgStatusQuery is how every async write is actually verified.',
    item: [
      masarRequest({
        name: '7.01 MsgStatusQuery (poll the last submission)',
        endpoint: 'MsgStatusQuery', tokenVar: 'mfgToken',
        tests: [
          '// 404 means "not found YET — may still be initializing" (the platform\'s own',
          '// wording). Re-send until it turns 200 with a terminal state; do NOT treat',
          '// 404 as a failure.',
          'if (pm.response.code === 404) {',
          '  pm.test.skip("still initializing — re-send this request");',
          '} else {',
          '  pm.test("200 OK", () => pm.response.to.have.status(200));',
          '  const j = pm.response.json();',
          '  console.log("state: " + JSON.stringify(j));',
          '  pm.test("reached SUCCESS", () => pm.expect(JSON.stringify(j)).to.match(/SUCCESS|COMPLETED/i));',
          '}',
        ],
        body: { instanceIdentifier: '{{lastInstanceId}}' },
      }),
      masarRequest({
        name: '7.02 VerifyProduct (pack state)',
        endpoint: 'VerifyProduct', tokenVar: 'mfgToken',
        tests: [
          'pm.test("200 OK", () => pm.response.to.have.status(200));',
          'const j = pm.response.json();',
          '// Returns 200 with verified:false for an unknown pack — the status code alone',
          '// proves nothing. Assert on verified / alerts.',
          'console.log("verified=" + j.verified + " alerts=" + JSON.stringify(j.alerts));',
          'pm.test("pack exists", () => pm.expect(j.alerts || []).to.not.include("NOT_FOUND"));',
        ],
        body: { productId: SGTIN, geoLatitude: '', geoLongitude: '' },
      }),
      masarRequest({
        name: '7.03 GET /epcis (message history)',
        method: 'GET', endpoint: 'epcis', query: 'limit=5', tokenVar: 'mfgToken',
        tests: [
          'pm.test("200 OK", () => pm.response.to.have.status(200));',
          'pm.test("items array", () => pm.expect(pm.response.json().items).to.be.an("array"));',
        ],
      }),
      masarRequest({
        name: '7.04 GET /scp/invoices (branch or pharmacy only)',
        method: 'GET', endpoint: 'scp/invoices', query: 'page=1&limit=5', tokenVar: 'branchToken',
        tests: [
          'pm.test("200 for branch/pharmacy", () => pm.response.to.have.status(200));',
          '// A manufacturer token returns 403 here — swap tokenVar to reproduce.',
        ],
      }),
    ],
  })

  return {
    info: {
      _postman_id: 'eptts-apis-ztestground',
      name: 'EPTTS APIs (Masar B2B) — devsim, verified',
      description: [
        'Generated by scripts/eptts-web-postman.js from the contract verified against',
        'production on 2026-08-31.',
        '',
        'SETUP',
        '1. Import both files (collection + environment).',
        '2. Fill mfgApiKey / branchApiKey / pharmacyApiKey in the environment. Keys cannot',
        '   be read back from the platform — they live in automation-hub/.env.',
        '3. Disable SSL certificate verification (Settings -> General): the host serves a',
        '   self-signed certificate.',
        '4. Connect the Citrix VPN. Nothing is reachable without it.',
        '5. Run folder "0. Auth" first to populate the token variables.',
        '',
        'HOW THIS DIFFERS FROM THE VENDOR COLLECTION',
        '- /auth is on :8445/registry-service, not :8444/masar-service (that path is a 404).',
        '- apikey is sent ONLY to /auth; all other requests use Authorization: Bearer alone.',
        '- GLNs/GTINs are the devsim tenant\'s real values, not staging placeholders.',
        '',
        'THE ASYNC CONTRACT',
        'A 202 means QUEUED, not applied. Always follow a write with 7.01 MsgStatusQuery',
        'until it returns SUCCESS, then assert the pack state with 7.02 VerifyProduct.',
        '',
        'WARNING: these requests write real, permanent EPCIS events to production.',
      ].join('\n'),
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: folders,
    variable: [
      ...Object.entries(VARS).map(([key, value]) => ({ key, value, type: 'string' })),
      { key: 'mfgToken', value: '', type: 'string' },
      { key: 'branchToken', value: '', type: 'string' },
      { key: 'pharmacyToken', value: '', type: 'string' },
      { key: 'eventTime', value: '', type: 'string' },
      { key: 'instanceId', value: '', type: 'string' },
      { key: 'lastInstanceId', value: '', type: 'string' },
      { key: 'serial', value: '', type: 'string' },
      { key: 'ssccSerial', value: '', type: 'string' },
    ],
  }
}

function buildEnvironment() {
  return {
    id: 'eptts-apis-devsim',
    name: 'EPTTS APIs — devsim (production via Citrix VPN)',
    values: [
      ...Object.entries(VARS).map(([key, value]) => ({ key, value, type: 'default', enabled: true })),
      // Secrets stay EMPTY here: exports/ is committed to git.
      ...SECRET_VARS.map((key) => ({ key, value: '', type: 'secret', enabled: true })),
    ],
    _postman_variable_scope: 'environment',
  }
}

// ─── main ────────────────────────────────────────────────────────────────────

const collection = build()
const environment = buildEnvironment()

let requests = 0
for (const f of collection.item) requests += f.item.length

console.log('folders:')
for (const f of collection.item) console.log(`  ${f.name.padEnd(42)} ${f.item.length} requests`)
console.log(`\ntotal: ${collection.item.length} folders, ${requests} requests`)
console.log(`environment: ${environment.values.length} variables (${SECRET_VARS.length} secret, left empty)`)

if (WRITE) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const cPath = path.join(OUT_DIR, 'eptts-apis.postman_collection.json')
  const ePath = path.join(OUT_DIR, 'eptts-apis.postman_environment.json')
  fs.writeFileSync(cPath, JSON.stringify(collection, null, 2) + '\n')
  fs.writeFileSync(ePath, JSON.stringify(environment, null, 2) + '\n')
  console.log(`\nwrote ${path.relative(REPO, cPath)}`)
  console.log(`wrote ${path.relative(REPO, ePath)}`)

  // Guard: no secret may ever be baked into a committed export.
  const blob = fs.readFileSync(cPath, 'utf8') + fs.readFileSync(ePath, 'utf8')
  const leak = /[a-f0-9]{64}/.exec(blob)
  if (leak) {
    console.error(`\n!! ABORTING: a 64-char hex value that looks like an API key is present: ${leak[0].slice(0, 8)}…`)
    process.exit(1)
  }
  console.log('secret-leak check: clean')
} else {
  console.log('\n(dry run — pass --write to emit the files)')
}
